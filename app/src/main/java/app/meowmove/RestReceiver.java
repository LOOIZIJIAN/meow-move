package app.meowmove;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.JSONObject;

public class RestReceiver extends BroadcastReceiver {
    private static PendingIntent pending(Context c,String cycle){return PendingIntent.getBroadcast(c,10,new Intent(c,RestReceiver.class).putExtra("cycle",cycle),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void sync(Context c,boolean force)throws Exception{
        JSONObject timer=new JSONObject(Store.get(c).load()).optJSONObject("restTimer");
        SharedPreferences p=c.getSharedPreferences("rest-alarm",Context.MODE_PRIVATE);
        AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        String cycle=timer==null?"":timer.optString("cycleId","");
        long end=timer==null?0:timer.optLong("endAt",0);
        String status=timer==null?"idle":timer.optString("status","idle");
        boolean running="running".equals(status)&&end>0;
        if(!running){alarms.cancel(pending(c,cycle));p.edit().clear().apply();if(!"done".equals(status))((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(10);return;}
        if(!force&&end==p.getLong("endAt",0)&&cycle.equals(p.getString("cycle","")))return;
        alarms.cancel(pending(c,cycle));
        ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(10);
        alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,SystemClock.elapsedRealtime()+Math.max(0,end-System.currentTimeMillis()),pending(c,cycle));
        p.edit().putLong("endAt",end).putString("cycle",cycle).apply();
    }
    public void onReceive(Context c,Intent intent){try{
        // The visible app handles its own completion; background notifications are acknowledged once.
        if(MainActivity.isVisible(c))return;
        Store store=Store.get(c);boolean notify;
        synchronized(store){
            JSONObject data=new JSONObject(store.load()),timer=data.optJSONObject("restTimer");
            if(timer==null||!"running".equals(timer.optString("status"))||timer.optLong("endAt",0)>System.currentTimeMillis()||timer.optBoolean("notified",false)||!timer.optString("cycleId","").equals(intent.getStringExtra("cycle")))return;
            timer.put("status","done").put("remainingMs",0).put("endAt",0).put("notified",true);
            JSONObject active=data.optJSONObject("active");if(active!=null&&active.optString("id").equals(timer.optString("sessionId")))active.put("restUntil",0);
            store.save(data.toString());
            notify=data.getJSONObject("preferences").optBoolean("restNotifications",false);
        }
        if(!notify)return;
        NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(!manager.areNotificationsEnabled())return;
        NotificationChannel channel=new NotificationChannel("rest","组间休息提醒",NotificationManager.IMPORTANCE_HIGH);channel.enableVibration(true);manager.createNotificationChannel(channel);
        Intent show=new Intent(c,MainActivity.class).putExtra("openTimer",true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open=PendingIntent.getActivity(c,0,show,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify(10,new Notification.Builder(c,"rest").setSmallIcon(R.drawable.ic_rest).setContentTitle("喵练 · 休息时间到啦").setContentText("准备好后，再开始下一组。").setContentIntent(open).setAutoCancel(true).build());
    }catch(Exception ignored){}}
}
