package app.meowmove;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

public class MainActivity extends Activity {
    private WebView web;
    static volatile boolean foreground;
    static boolean isVisible(Context context){return foreground&&((PowerManager)context.getSystemService(POWER_SERVICE)).isInteractive()&&!((KeyguardManager)context.getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();}
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private static final int BACKUP=21,EXPORT=22,IMPORT=23;
    @Override public void onCreate(Bundle state){super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(249,236,210));getWindow().setNavigationBarColor(Color.rgb(249,236,210));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(249,236,210));
        // WebView does not reliably inset its HTML viewport when padded directly.
        // Inset the parent instead so fixed controls and the keyboard share the safe viewport.
        FrameLayout viewport=new FrameLayout(this);viewport.setBackgroundColor(Color.rgb(249,236,210));
        viewport.addView(web,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));setContentView(viewport);
        if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);getWindow().getInsetsController().setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);viewport.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());android.graphics.Insets ime=insets.getInsets(WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));return WindowInsets.CONSUMED;});viewport.requestApplyInsets();}
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(),"Android");
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView v,String url){if(getIntent().getBooleanExtra("openTimer",false))v.evaluateJavascript("window.openRestTimer&&window.openRestTimer()",null);}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
                String url=r.getUrl().toString();if(!url.startsWith(ORIGIN+"assets/"))return blocked();
                String path=url.substring((ORIGIN+"assets/").length()).split("\\?")[0];if(path.contains("..")||path.contains("%"))return blocked();
                try{String mime=path.endsWith(".css")?"text/css":path.endsWith(".js")?"application/javascript":path.endsWith(".json")?"application/json":path.endsWith(".webp")?"image/webp":path.endsWith(".woff2")?"font/woff2":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(path));}catch(Exception e){return blocked();}
            }
            private WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
        });
        web.setWebChromeClient(new WebChromeClient());web.loadUrl(ORIGIN+"assets/index.html");
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->handleBack());
    }
    @Override protected void onResume(){super.onResume();foreground=true;try{RestReceiver.sync(this,true);}catch(Exception ignored){}Backup.kick(this);if(web!=null)web.postDelayed(()->web.evaluateJavascript("window.nativeResume&&window.nativeResume()",null),250);}
    @Override protected void onPause(){foreground=false;getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);super.onPause();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(intent.getBooleanExtra("openTimer",false))web.evaluateJavascript("window.openRestTimer&&window.openRestTimer()",null);}
    private void handleBack(){web.evaluateJavascript("window.appBack&&window.appBack()",result->{if("false".equals(result))finish();});}
    @Override public boolean onKeyUp(int keyCode,KeyEvent event){if(Build.VERSION.SDK_INT<33&&keyCode==KeyEvent.KEYCODE_BACK){handleBack();return true;}return super.onKeyUp(keyCode,event);}
    private void event(JSONObject data){runOnUiThread(()->{if(!isFinishing())web.evaluateJavascript("window.nativeEvent&&window.nativeEvent("+data+")",null);});}
    private void notice(String message){try{event(new JSONObject().put("type","notice").put("message",message));}catch(Exception ignored){}}
    private String error(Exception e){try{return new JSONObject().put("ok",false).put("error",e.getMessage()==null?"操作失败":e.getMessage()).toString();}catch(Exception ignored){return "{\"ok\":false}";}}
    private void picker(String action,String mime,int request,String name){Intent i=new Intent(action);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);if(name!=null)i.putExtra(Intent.EXTRA_TITLE,name);if(request==IMPORT)i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);try{startActivityForResult(i,request);}catch(Exception e){notice("手机没有可用的文件选择器");}}
    private final class Bridge {
        @JavascriptInterface public String load(){try{return Store.get(MainActivity.this).load();}catch(Exception e){return error(e);}}
        @JavascriptInterface public String save(String value,boolean backupNow){try{Store store=Store.get(MainActivity.this);store.save(value);try{RestReceiver.sync(MainActivity.this,false);}catch(Exception ignored){}if(backupNow)try{store.snapshot();}catch(Exception ignored){}try{Backup.changed(MainActivity.this);if(backupNow)Backup.kick(MainActivity.this);}catch(Exception ignored){}return "{\"ok\":true}";}catch(Exception e){return error(e);}}
        @JavascriptInterface public String backupStatus(){return Backup.status(MainActivity.this);}
        @JavascriptInterface public void chooseBackup(){runOnUiThread(()->picker(Intent.ACTION_CREATE_DOCUMENT,"application/json",BACKUP,"meow-move-backup.json"));}
        @JavascriptInterface public void backupNow(){Backup.changed(MainActivity.this);Backup.kick(MainActivity.this);notice("正在更新备份文件");}
        @JavascriptInterface public void disconnectBackup(){Backup.disconnect(MainActivity.this);notice("已停止自动备份，原备份文件仍保留");}
        @JavascriptInterface public void importFile(){runOnUiThread(()->picker(Intent.ACTION_OPEN_DOCUMENT,"*/*",IMPORT,null));}
        @JavascriptInterface public void export(String name,String mime,String contents,boolean share){
            if(!name.matches("[A-Za-z0-9._-]+")||contents.length()>20*1024*1024)return;
            try{File dir=new File(getCacheDir(),"exports");dir.mkdirs();File f=new File(dir,name);try(FileOutputStream out=new FileOutputStream(f)){out.write(contents.getBytes(StandardCharsets.UTF_8));}
                if(share)runOnUiThread(()->{Uri uri=Uri.parse("content://app.meowmove.exports/"+name);Intent i=new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);i.setClipData(ClipData.newRawUri(name,uri));startActivity(Intent.createChooser(i,"导出训练记录"));});
                else{getSharedPreferences("export",MODE_PRIVATE).edit().putString("path",f.getAbsolutePath()).putString("mime",mime).apply();runOnUiThread(()->picker(Intent.ACTION_CREATE_DOCUMENT,mime,EXPORT,name));}
            }catch(Exception e){notice("导出失败，请重试");}
        }
        @JavascriptInterface public boolean restNotified(String cycle){try{JSONObject timer=new JSONObject(Store.get(MainActivity.this).load()).optJSONObject("restTimer");return timer!=null&&cycle.equals(timer.optString("cycleId"))&&timer.optBoolean("notified",false);}catch(Exception ignored){return false;}}
        @JavascriptInterface public void keepScreenOn(boolean enabled){runOnUiThread(()->{if(enabled&&foreground)getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);});}
        @JavascriptInterface public void vibrate(){Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(v!=null)v.vibrate(VibrationEffect.createOneShot(90,VibrationEffect.DEFAULT_AMPLITUDE));}
        @JavascriptInterface public boolean notificationsEnabled(){return ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).areNotificationsEnabled();}
        @JavascriptInterface public boolean isForeground(){return isVisible(MainActivity.this);}
        @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},31);});}
        @JavascriptInterface public String recovery(){try{File f=new File(getFilesDir(),"recovery.json");return f.exists()?Store.read(new FileInputStream(f),20*1024*1024):"null";}catch(Exception e){return "null";}}
    }
    @Override protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);if(result!=RESULT_OK||intent==null||intent.getData()==null&&intent.getClipData()==null)return;
        if(request==BACKUP){Uri uri=intent.getData();int flags=intent.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            try{if((flags&Intent.FLAG_GRANT_WRITE_URI_PERMISSION)==0)throw new SecurityException();if((flags&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0)getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);else getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_WRITE_URI_PERMISSION);Backup.prefs(this).edit().putString("uri",uri.toString()).putBoolean("drive",uri.getAuthority()!=null&&uri.getAuthority().contains("com.google.android.apps.docs")).putString("name",name(uri)).putBoolean("pending",true).putString("error","").apply();Backup.schedule(this);Backup.kick(this);notice("自动备份已启用");}catch(Exception e){notice("该位置不支持持续写入，请重新选择备份文件");}
        }
        if(request==EXPORT){Uri uri=intent.getData();String path=getSharedPreferences("export",MODE_PRIVATE).getString("path","");Backup.IO.execute(()->{try(InputStream in=new FileInputStream(path);OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);notice("已保存导出文件");}catch(Exception e){notice("文件未保存，请重试");}});}
        if(request==IMPORT){ArrayList<Uri> uris=new ArrayList<>();if(intent.getClipData()!=null){for(int n=0;n<Math.min(100,intent.getClipData().getItemCount());n++)uris.add(intent.getClipData().getItemAt(n).getUri());}else uris.add(intent.getData());Backup.IO.execute(()->{try{JSONArray files=new JSONArray();for(Uri uri:uris){String text=Store.read(getContentResolver().openInputStream(uri),20*1024*1024);byte[] digest=MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));StringBuilder h=new StringBuilder();for(byte v:digest)h.append(String.format("%02x",v));files.put(new JSONObject().put("name",name(uri)).put("text",text).put("id","note-"+h));}event(new JSONObject().put("type","import").put("files",files));}catch(Exception e){notice("无法读取文件，请选择 Markdown 笔记或喵练 JSON 备份");}});}
    }
    private String name(Uri uri){try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){return c!=null&&c.moveToFirst()?c.getString(0):"meow-move-backup.json";}catch(Exception e){return "meow-move-backup.json";}}
}
