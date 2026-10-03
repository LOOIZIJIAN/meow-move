package app.meowmove;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.*;
import org.json.*;

public class RestReceiver extends BroadcastReceiver {
    static final String CHANGED="app.meowmove.REST_CHANGED";
    private static PendingIntent pending(Context c,String cycle){return PendingIntent.getBroadcast(c,10,new Intent(c,RestReceiver.class).putExtra("cycle",cycle),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private static PendingIntent action(Context c,String cycle,String action,int code){return PendingIntent.getBroadcast(c,code,new Intent(c,RestReceiver.class).setAction(action).putExtra("cycle",cycle),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private static PendingIntent open(Context c){return PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).putExtra("openTimer",true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    // Last posted timer state; saves from the page call sync() often and re-posting would refresh the island for nothing.
    private static String shown;
    private static void progress(Context c,JSONObject timer,JSONObject prefs)throws JSONException{
        NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        String status=timer.optString("status");boolean running="running".equals(status),paused="paused".equals(status);
        if(!prefs.optBoolean("restNotifications",false)||!manager.areNotificationsEnabled()||(!running&&!paused)){manager.cancel(11);shown=null;return;}
        String key=status+"|"+timer.optString("cycleId")+"|"+timer.optLong("endAt")+"|"+timer.optLong("remainingMs");
        if(key.equals(shown))for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if(n.getId()==11)return;
        NotificationChannel channel=new NotificationChannel("rest-progress","休息计时控制",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);manager.createNotificationChannel(channel);
        long ms=running?Math.max(0,timer.optLong("endAt")-System.currentTimeMillis()):timer.optLong("remainingMs");
        String cycle=timer.optString("cycleId"),time=String.format(java.util.Locale.ROOT,"%02d:%02d",(ms+999)/60000,((ms+999)/1000)%60);
        PendingIntent toggle=action(c,cycle,running?"pause":"resume",12),extend=action(c,cycle,"extend",13),reset=action(c,cycle,"reset",14);
        Notification.Builder builder=new Notification.Builder(c,"rest-progress").setSmallIcon(R.drawable.ic_rest).setContentTitle("喵练 · "+(paused?"休息已暂停":"组间休息"))
            .setContentText(paused?"剩余 "+time:"休息好，再开始下一组。").setContentIntent(open(c)).setOnlyAlertOnce(true).setOngoing(true)
            .addAction(new Notification.Action.Builder(null,running?"暂停":"继续",toggle).build())
            .addAction(new Notification.Action.Builder(null,"+15秒",extend).build())
            .addAction(new Notification.Action.Builder(null,"结束休息",reset).build());
        if(running)builder.setWhen(timer.optLong("endAt")).setUsesChronometer(true).setChronometerCountDown(true);
        // HyperOS 3 shows the focus payload on Hyper Island; elsewhere Android 16+ can promote it to a Live Update chip.
        if(Island.supported(c))Island.apply(c,builder,running,timer.optLong("endAt"),time,toggle,extend,reset);
        else{Bundle live=new Bundle();live.putBoolean("android.requestPromotedOngoing",true);builder.addExtras(live);}
        manager.notify(11,builder.build());shown=key;
    }
    static void sync(Context c,boolean force)throws Exception{
        JSONObject data=new JSONObject(Store.get(c).load()),timer=data.optJSONObject("restTimer");if(timer==null)return;
        progress(c,timer,data.getJSONObject("preferences"));
        SharedPreferences p=c.getSharedPreferences("rest-alarm",Context.MODE_PRIVATE);
        AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        String cycle=timer.optString("cycleId","");long end=timer.optLong("endAt",0);String status=timer.optString("status","idle");
        if(!"running".equals(status)||end==0){alarms.cancel(pending(c,cycle));p.edit().clear().apply();if(!"done".equals(status))((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(10);return;}
        if(!force&&end==p.getLong("endAt",0)&&cycle.equals(p.getString("cycle","")))return;
        alarms.cancel(pending(c,cycle));((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(10);
        // Exact so the island leaves 00:00 on time; inexact alarms ran ~50s late on HyperOS even with the screen on.
        long at=SystemClock.elapsedRealtime()+Math.max(0,end-System.currentTimeMillis());
        if(Build.VERSION.SDK_INT<31||alarms.canScheduleExactAlarms())alarms.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,at,pending(c,cycle));
        else alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,at,pending(c,cycle));
        p.edit().putLong("endAt",end).putString("cycle",cycle).apply();
    }
    public void onReceive(Context c,Intent intent){try{
        if(Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())){sync(c,true);return;}
        Store store=Store.get(c);JSONObject preferences;boolean expiry=intent.getAction()==null;
        synchronized(store){
            JSONObject data=new JSONObject(store.load()),timer=data.optJSONObject("restTimer");
            if(timer==null||!timer.optString("cycleId","").equals(intent.getStringExtra("cycle")))return;
            String status=timer.optString("status");long now=System.currentTimeMillis(),ms="running".equals(status)?Math.max(0,Math.min(3600000,timer.optLong("endAt")-now)):timer.optLong("remainingMs");
            if(expiry){if(MainActivity.isVisible(c)||!"running".equals(status)||ms>0||timer.optBoolean("notified",false))return;timer.put("status","done").put("remainingMs",0).put("endAt",0).put("notified",true);}
            else{if(!"running".equals(status)&&!"paused".equals(status))return;switch(intent.getAction()){
                case "pause":if(!"running".equals(status))return;timer.put("status",ms==0?"done":"paused").put("remainingMs",ms).put("endAt",0);break;
                case "resume":if(!"paused".equals(status))return;timer.put("status",ms==0?"done":"running").put("endAt",ms==0?0:now+ms);break;
                case "extend":ms=Math.min(3600000,ms+15000);timer.put("remainingMs",ms).put("endAt","running".equals(status)?now+ms:0);break;
                case "reset":timer.put("status","idle").put("remainingMs",timer.getInt("durationSec")*1000).put("endAt",0).put("cycleId",JSONObject.NULL).put("sessionId",JSONObject.NULL).put("notified",false);break;
                default:return;
            }}
            timer.put("controlRevision",timer.optLong("controlRevision",0)+1);
            JSONObject active=data.optJSONObject("active");if(active!=null)active.put("restUntil",active.optString("id").equals(timer.optString("sessionId"))?timer.optLong("endAt"):0);
            store.save(data.toString());preferences=data.getJSONObject("preferences");
        }
        sync(c,true);Backup.changed(c);c.sendBroadcast(new Intent(CHANGED).setPackage(c.getPackageName()));
        if(!expiry||!preferences.optBoolean("restNotifications",false))return;
        NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(!manager.areNotificationsEnabled())return;
        boolean sound=preferences.optBoolean("restSound",false);String channelId=sound?"rest-sound-v2":"rest-silent-v2";
        NotificationChannel channel=new NotificationChannel(channelId,sound?"休息到时 · 声音":"休息到时 · 静音",NotificationManager.IMPORTANCE_HIGH);channel.enableVibration(true);
        channel.setSound(sound?RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION):null,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());manager.createNotificationChannel(channel);
        manager.notify(10,new Notification.Builder(c,channelId).setSmallIcon(R.drawable.ic_rest).setContentTitle("喵练 · 休息时间到啦").setContentText("准备好后，再开始下一组。").setContentIntent(open(c)).setAutoCancel(true).build());
    }catch(Exception ignored){}}
}
