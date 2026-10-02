package app.meowmove;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.AtomicFile;
import org.json.JSONObject;
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
    synchronized void snapshot() throws Exception {
        AtomicFile f=new AtomicFile(new File(context.getFilesDir(),"recovery.json"));FileOutputStream out=null;
        try{out=f.startWrite();out.write(load().getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}catch(Exception e){if(out!=null)f.failWrite(out);throw e;}
    }
}
