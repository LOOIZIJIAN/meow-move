package app.meowmove;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

final class Backup {
    static final ExecutorService IO=Executors.newSingleThreadExecutor();
    static final int JOB=3201;
    static SharedPreferences prefs(Context c){return c.getSharedPreferences("backup",Context.MODE_PRIVATE);}
    static void changed(Context c){SharedPreferences p=prefs(c);if(p.getString("uri","").isEmpty())return;p.edit().putBoolean("pending",true).apply();schedule(c);}
    static void schedule(Context c){
        JobInfo job=new JobInfo.Builder(JOB,new ComponentName(c,BackupJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(30000).setBackoffCriteria(60000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build();
        ((JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE)).schedule(job);
    }
    static void kick(Context c){Context app=c.getApplicationContext();IO.execute(()->write(app));}
    static synchronized boolean write(Context c){
        SharedPreferences p=prefs(c);String value=p.getString("uri","");if(value.isEmpty()||!p.getBoolean("pending",false))return true;
        try{
            Store s=Store.get(c);String payload;long revision;
            synchronized(s){payload=s.load();revision=s.revision();}
            // The provider acknowledges a file write; remote Drive upload is handled by that provider.
            try(OutputStream out=c.getContentResolver().openOutputStream(Uri.parse(value),"wt")) {if(out==null)throw new Exception("无法写入备份文件");out.write(payload.getBytes(StandardCharsets.UTF_8));out.flush();}
            boolean pending=s.revision()!=revision;
            if(!value.equals(p.getString("uri","")))return false;
            p.edit().putLong("writtenAt",System.currentTimeMillis()).putBoolean("pending",pending).putString("error","").apply();
            try{s.snapshot();}catch(Exception ignored){}if(pending)schedule(c);return !pending;
        }catch(Exception e){p.edit().putString("error","备份文件暂时无法写入，请检查网络或重新选择文件").putBoolean("pending",true).apply();return false;}
    }
    static String status(Context c){try{SharedPreferences p=prefs(c);return new JSONObject().put("connected",!p.getString("uri","").isEmpty()).put("drive",p.getBoolean("drive",false)).put("name",p.getString("name","meow-move-backup.json")).put("writtenAt",p.getLong("writtenAt",0)).put("pending",p.getBoolean("pending",false)).put("error",p.getString("error","")).toString();}catch(Exception e){return "{}";}}
    static void disconnect(Context c){String uri=prefs(c).getString("uri","");if(!uri.isEmpty())try{c.getContentResolver().releasePersistableUriPermission(Uri.parse(uri),android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION|android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION);}catch(Exception ignored){}
        prefs(c).edit().clear().apply();((JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE)).cancel(JOB);
    }
}
