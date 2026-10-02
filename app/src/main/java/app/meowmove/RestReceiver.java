package app.meowmove;
import android.app.*;
import android.content.*;
import android.os.*;
import org.json.JSONObject;

public class RestReceiver extends BroadcastReceiver {
    static PendingIntent pending(Context c){return PendingIntent.getBroadcast(c,10,new Intent(c,RestReceiver.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void cancel(Context c){((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(pending(c));((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(10);}
    static void start(Context c,int seconds){cancel(c);if(seconds<=0)return;((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,SystemClock.elapsedRealtime()+seconds*1000L,pending(c));}
    public void onReceive(Context c,Intent intent){try{
        JSONObject data=new JSONObject(Store.get(c).load()),active=data.optJSONObject("active");if(active==null||active.optLong("restUntil",0)>System.currentTimeMillis()+3000||!data.getJSONObject("preferences").optBoolean("restNotifications",false))return;
        NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(!manager.areNotificationsEnabled())return;
        NotificationChannel channel=new NotificationChannel("rest","组间休息提醒",NotificationManager.IMPORTANCE_HIGH);channel.enableVibration(true);manager.createNotificationChannel(channel);
        PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify(10,new Notification.Builder(c,"rest").setSmallIcon(R.drawable.ic_rest).setContentTitle("喵练 · 休息时间到啦").setContentText("准备好后，再开始下一组。").setContentIntent(open).setAutoCancel(true).build());
    }catch(Exception ignored){}}
}
