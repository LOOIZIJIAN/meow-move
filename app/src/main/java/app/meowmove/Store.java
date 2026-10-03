package app.meowmove;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.AtomicFile;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.Arrays;
import java.util.Comparator;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Single transactional document, also exported as portable versioned JSON. */
final class Store extends SQLiteOpenHelper {
    private static Store instance;
    private final Context context;
    static synchronized Store get(Context c) { if(instance==null) instance=new Store(c.getApplicationContext()); return instance; }
    private Store(Context c) { super(c,"training.db",null,1);context=c; }
    public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE document (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL)"); }
    public void onUpgrade(SQLiteDatabase db,int old,int next) { throw new IllegalStateException("Unsupported data version"); }
    static String read(InputStream in,int limit) throws IOException {
        try(InputStream input=in; ByteArrayOutputStream out=new ByteArrayOutputStream()) { byte[] buf=new byte[8192];int n;while((n=input.read(buf))!=-1){if(out.size()+n>limit)throw new IOException("文件超过20MB");out.write(buf,0,n);}return out.toString(StandardCharsets.UTF_8.name()); }
    }
    synchronized String load() throws Exception {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM document WHERE id=1",null)){if(c.moveToFirst())return c.getString(0);}
        String seed=read(context.getAssets().open("seed.json"),20*1024*1024);save(seed);return seed;
    }
    synchronized long revision() {try(Cursor c=getReadableDatabase().rawQuery("SELECT revision FROM document WHERE id=1",null)){return c.moveToFirst()?c.getLong(0):0;}}
    synchronized long save(String payload) throws Exception {
        if(payload.length()>20*1024*1024)throw new IOException("训练数据超过20MB");
        JSONObject data=new JSONObject(payload);
        if(!"meow-move".equals(data.optString("app"))||data.optInt("schema")!=1||data.optJSONArray("sessions")==null||data.optJSONArray("catalog")==null||data.optJSONArray("sources")==null||data.optJSONObject("preferences")==null)throw new IOException("无效的训练数据");
        SQLiteDatabase db=getWritableDatabase();long rev=revision()+1;db.beginTransaction();
        try{ContentValues v=new ContentValues();v.put("id",1);v.put("payload",payload);v.put("revision",rev);db.insertWithOnConflict("document",null,v,SQLiteDatabase.CONFLICT_REPLACE);db.setTransactionSuccessful();}finally{db.endTransaction();}
        return rev;
    }
    synchronized JSONObject saveFromWeb(String value,boolean critical)throws Exception{
        JSONObject data=new JSONObject(value),old=new JSONObject(load()),nativeTimer=old.optJSONObject("restTimer"),incoming=data.optJSONObject("restTimer");
        if(nativeTimer!=null&&incoming!=null&&incoming.optLong("controlRevision",0)<nativeTimer.optLong("controlRevision",0)){data.put("restTimer",nativeTimer);JSONObject active=data.optJSONObject("active");if(active!=null)active.put("restUntil",active.optString("id").equals(nativeTimer.optString("sessionId"))?nativeTimer.optLong("endAt"):0);}
        if(critical)try{snapshot();}catch(Exception ignored){}save(data.toString());if(critical)try{snapshot();}catch(Exception ignored){}return data;
    }
    private File versionsDir(){File dir=new File(context.getFilesDir(),"versions");dir.mkdirs();return dir;}
    private File[] versions(){File[] list=versionsDir().listFiles((d,name)->name.matches("backup-[0-9]+-[0-9]+\\.json"));if(list==null)return new File[0];Arrays.sort(list,Comparator.<File>comparingLong(f->Long.parseLong(f.getName().split("-")[1])).reversed().thenComparing(Comparator.<File>comparingLong(f->Long.parseLong(f.getName().split("-")[2].replace(".json",""))).reversed()));return list;}
    synchronized JSONArray backupVersions(){JSONArray out=new JSONArray();for(File f:versions())try{out.put(new JSONObject().put("name",f.getName()).put("createdAt",f.lastModified()).put("bytes",f.length()));}catch(Exception ignored){}return out;}
    synchronized String recoveryVersion(String name)throws Exception{if(name==null||!name.matches("backup-[0-9]+-[0-9]+\\.json"))throw new IOException("版本名称无效");return read(new FileInputStream(new File(versionsDir(),name)),20*1024*1024);}
    private void atomic(File file,String payload)throws Exception{AtomicFile f=new AtomicFile(file);FileOutputStream out=null;try{out=f.startWrite();out.write(payload.getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}catch(Exception e){if(out!=null)f.failWrite(out);throw e;}}
    synchronized void snapshot() throws Exception {
        String payload=load();File[] old=versions();
        atomic(new File(context.getFilesDir(),"recovery.json"),payload);
        if(old.length>0&&payload.equals(read(new FileInputStream(old[0]),20*1024*1024)))return;
        atomic(new File(versionsDir(),"backup-"+System.currentTimeMillis()+"-"+revision()+".json"),payload);
        File[] list=versions();for(int i=10;i<list.length;i++)if(!list[i].delete())throw new IOException("无法清理旧版本");
    }
}
