package app.meowmove;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

public class ExportProvider extends ContentProvider {
    public boolean onCreate(){return true;}
    private File file(Uri u)throws FileNotFoundException{String n=u.getLastPathSegment();if(n==null||!n.matches("[A-Za-z0-9._-]+")||n.contains(".."))throw new FileNotFoundException();File f=new File(new File(getContext().getCacheDir(),"exports"),n);if(!f.isFile())throw new FileNotFoundException();return f;}
    public String getType(Uri u){String p=u.getLastPathSegment();return p!=null&&p.endsWith(".csv")?"text/csv":p!=null&&p.endsWith(".json")?"application/json":"text/markdown";}
    public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("Read only");return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.MODE_READ_ONLY);}
    public Cursor query(Uri u,String[] projection,String selection,String[] args,String sort){try{File f=file(u);String[] cols=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor c=new MatrixCursor(cols);Object[] row=new Object[cols.length];for(int i=0;i<cols.length;i++)row[i]=OpenableColumns.DISPLAY_NAME.equals(cols[i])?f.getName():OpenableColumns.SIZE.equals(cols[i])?f.length():null;c.addRow(row);return c;}catch(Exception e){return null;}}
    public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
    public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
    public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
