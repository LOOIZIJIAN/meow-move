package app.meowmove;

import android.app.*;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import org.json.*;

// Xiaomi HyperOS 3 Hyper Island (focus notification) payload for the rest timer.
// SystemUI ticks the countdown from timerWhen, so the notification only changes on pause, resume, +15s or reset.
// Verified on OS3.0.303: an Android 16 promoted-ongoing request makes HyperOS ignore these extras, so callers use one or the other.
final class Island {
    private static Bitmap cat;
    static boolean supported(Context c){try{
        if(Settings.System.getInt(c.getContentResolver(),"notification_focus_protocol",0)<3)return false;
        Bundle in=new Bundle();in.putString("package",c.getPackageName());
        Bundle out=c.getContentResolver().call(Uri.parse("content://miui.statusbar.notification.public"),"canShowFocus",null,in);
        return out!=null&&out.getBoolean("canShowFocus",false);
    }catch(Exception e){return false;}}
    static void apply(Context c,Notification.Builder builder,boolean running,long endAt,String time,PendingIntent toggle,PendingIntent extend,PendingIntent reset)throws JSONException{
        long now=System.currentTimeMillis();String title=running?"组间休息":"已暂停",toggleTitle=running?"暂停":"继续";
        JSONObject pic=new JSONObject().put("type",1).put("pic","miui.focus.pic_cat");
        JSONObject timer=new JSONObject().put("timerType",-1).put("timerWhen",endAt).put("timerTotal",now).put("timerSystemCurrent",now);
        JSONObject chat=new JSONObject().put("type",1).put("title",title).put("picProfile","miui.focus.pic_cat");
        if(running)chat.put("timerInfo",timer);else chat.put("content","剩余 "+time);
        JSONObject digits=running?new JSONObject().put("timerInfo",timer).put("showHighlightColor",true):new JSONObject().put("digit",time).put("showHighlightColor",false);
        JSONObject island=new JSONObject().put("islandProperty",1).put("islandPriority",2)
            .put("bigIslandArea",new JSONObject().put("imageTextInfoLeft",new JSONObject().put("type",1).put("picInfo",pic).put("textInfo",new JSONObject().put("title",running?"休息":"已暂停"))).put("sameWidthDigitInfo",digits))
            .put("smallIslandArea",new JSONObject().put("picInfo",pic));
        JSONArray actions=new JSONArray().put(action("toggle")).put(action("extend")).put(action("reset"));
        JSONObject v2=new JSONObject().put("protocol",3).put("business","rest_timer").put("ticker",title).put("updatable",true).put("enableFloat",false).put("isShowNotification",true)
            .put("chatInfo",chat).put("param_island",island).put("actions",actions);
        Bundle pics=new Bundle();pics.putParcelable("miui.focus.pic_cat",Icon.createWithBitmap(cat(c)));
        Bundle acts=new Bundle();
        acts.putParcelable("miui.focus.action_toggle",new Notification.Action.Builder(button(running?"pause":"play",0xFF8CD2B1,0xFF396850),toggleTitle,toggle).build());
        acts.putParcelable("miui.focus.action_extend",new Notification.Action.Builder(button("+15",0xFFFFC76E,0xFF825B2E),"+15秒",extend).build());
        acts.putParcelable("miui.focus.action_reset",new Notification.Action.Builder(button("end",0xFFF39B84,0xFF905747),"结束休息",reset).build());
        Bundle extras=new Bundle();extras.putString("miui.focus.param",new JSONObject().put("param_v2",v2).toString());extras.putBundle("miui.focus.pics",pics);extras.putBundle("miui.focus.actions",acts);
        builder.addExtras(extras);
    }
    // Icon buttons (type 0) delivered as broadcasts (actionIntentType 2) through the matching miui.focus.actions entry.
    // OS3.0.303 renders a single text-only button (type 2) on this card, so the controls are round candy icons like the in-app tiles.
    private static JSONObject action(String key)throws JSONException{return new JSONObject().put("type",0).put("action","miui.focus.action_"+key).put("actionIntentType",2);}
    private static Icon button(String glyph,int fill,int ink){
        int size=128;Bitmap out=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(out);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(fill);canvas.drawCircle(64,64,64,paint);paint.setColor(ink);
        switch(glyph){
            case "pause":canvas.drawRoundRect(new RectF(42,38,57,90),6,6,paint);canvas.drawRoundRect(new RectF(71,38,86,90),6,6,paint);break;
            case "play":{Path p=new Path();p.moveTo(48,36);p.lineTo(92,64);p.lineTo(48,92);p.close();paint.setStrokeJoin(Paint.Join.ROUND);paint.setStrokeWidth(10);paint.setStyle(Paint.Style.FILL_AND_STROKE);canvas.drawPath(p,paint);break;}
            case "end":paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(13);paint.setStrokeCap(Paint.Cap.ROUND);canvas.drawLine(45,45,83,83,paint);canvas.drawLine(83,45,45,83,paint);break;
            default:paint.setTextAlign(Paint.Align.CENTER);paint.setTextSize(46);paint.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));canvas.drawText(glyph,64,64-(paint.descent()+paint.ascent())/2,paint);
        }
        return Icon.createWithBitmap(out);
    }
    // Round crop of the cat's head from the in-app illustration, on the app's cream background.
    private static synchronized Bitmap cat(Context c){
        if(cat!=null)return cat;
        int size=144;Bitmap out=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(out);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        paint.setColor(Color.rgb(249,236,210));canvas.drawCircle(size/2f,size/2f,size/2f,paint);
        try(java.io.InputStream in=c.getAssets().open("cat.webp")){
            BitmapFactory.Options o=new BitmapFactory.Options();o.inSampleSize=4;Bitmap art=BitmapFactory.decodeStream(in,null,o);
            if(art!=null){float s=art.getWidth()/1230f;Path clip=new Path();clip.addCircle(size/2f,size/2f,size/2f,Path.Direction.CW);canvas.clipPath(clip);
                canvas.drawBitmap(art,new Rect(Math.round(230*s),Math.round(40*s),Math.round(990*s),Math.round(800*s)),new RectF(0,0,size,size),paint);art.recycle();}
        }catch(Exception ignored){}
        return cat=out;
    }
}
