package app.meowmove;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.service.notification.StatusBarNotification;
import android.test.InstrumentationTestCase;
import org.json.*;

/** Runs only on an explicitly selected test emulator; uses the public, empty seed. */
@SuppressWarnings("deprecation")
public class TrainingNativeTest extends InstrumentationTestCase {
    private Context c;private Store store;
    protected void setUp()throws Exception{super.setUp();assertTrue("Use a dedicated emulator; this test replaces test data",android.os.Build.HARDWARE.equals("ranchu")||android.os.Build.HARDWARE.equals("goldfish"));c=getInstrumentation().getTargetContext();store=Store.get(c);MainActivity.foreground=false;}
    private JSONObject load()throws Exception{return new JSONObject(store.load());}
    private Notification ongoing(){for(StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())if(n.getId()==11)return n.getNotification();return null;}
    private void waitStatus(String expected)throws Exception{for(int i=0;i<50;i++){if(expected.equals(load().getJSONObject("restTimer").getString("status")))return;Thread.sleep(100);}assertEquals(expected,load().getJSONObject("restTimer").getString("status"));}
    private void action(int index)throws Exception{Notification n=ongoing();assertNotNull(n);assertEquals(3,n.actions.length);n.actions[index].actionIntent.send();Thread.sleep(250);}
    public void testNotificationControlsAndStaleWebSave()throws Exception{
        JSONObject data=new JSONObject(Store.read(c.getAssets().open("seed.json"),20*1024*1024));data.getJSONObject("preferences").put("restNotifications",true);
        JSONObject timer=data.getJSONObject("restTimer").put("status","running").put("durationSec",120).put("remainingMs",120000).put("endAt",System.currentTimeMillis()+120000).put("cycleId","native-controls-test").put("controlRevision",0);
        store.save(data.toString());RestReceiver.sync(c,true);JSONObject stale=new JSONObject(data.toString());
        action(0);waitStatus("paused");JSONObject paused=load().getJSONObject("restTimer");long ms=paused.getLong("remainingMs");assertEquals(1,paused.getInt("controlRevision"));
        stale.getJSONObject("preferences").put("catName","typed-draft");JSONObject saved=store.saveFromWeb(stale.toString(),false);assertEquals("paused",saved.getJSONObject("restTimer").getString("status"));assertEquals("typed-draft",load().getJSONObject("preferences").getString("catName"));
        action(1);assertEquals(ms+15000,load().getJSONObject("restTimer").getLong("remainingMs"));action(0);waitStatus("running");action(2);waitStatus("idle");assertNull(ongoing());assertEquals(0,load().getJSONArray("sessions").length());
        // A stale action from a previous cycle cannot alter a new timer.
        JSONObject next=load();next.getJSONObject("restTimer").put("status","running").put("endAt",System.currentTimeMillis()+60000).put("cycleId","new-cycle");store.save(next.toString());new RestReceiver().onReceive(c,new Intent(c,RestReceiver.class).setAction("pause").putExtra("cycle","native-controls-test"));assertEquals("running",load().getJSONObject("restTimer").getString("status"));
        JSONObject expire=load();expire.getJSONObject("restTimer").put("endAt",System.currentTimeMillis()-1).put("notified",false);store.save(expire.toString());new RestReceiver().onReceive(c,new Intent(c,RestReceiver.class).putExtra("cycle","new-cycle"));assertEquals("done",load().getJSONObject("restTimer").getString("status"));assertTrue(load().getJSONObject("restTimer").getBoolean("notified"));boolean done=false;for(StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())if(n.getId()==10)done=true;assertTrue(done);
    }
    public void testSnapshotRetentionAndSafeVersionReads()throws Exception{
        JSONObject data=new JSONObject(Store.read(c.getAssets().open("seed.json"),20*1024*1024));
        for(int i=0;i<15;i++){data.getJSONObject("preferences").put("catName","version-"+i);store.saveFromWeb(data.toString(),true);Thread.sleep(2);}
        JSONArray list=store.backupVersions();assertEquals(10,list.length());JSONObject latest=new JSONObject(store.recoveryVersion(list.getJSONObject(0).getString("name")));assertEquals("version-14",latest.getJSONObject("preferences").getString("catName"));store.snapshot();assertEquals(10,store.backupVersions().length());
        try{store.recoveryVersion("../recovery.json");fail("Unsafe file name accepted");}catch(java.io.IOException expected){}assertEquals("version-14",load().getJSONObject("preferences").getString("catName"));
    }
}
