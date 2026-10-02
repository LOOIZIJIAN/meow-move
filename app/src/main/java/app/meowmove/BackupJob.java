package app.meowmove;
import android.app.job.JobService;
import android.app.job.JobParameters;
public class BackupJob extends JobService {
    public boolean onStartJob(JobParameters p){Backup.IO.execute(()->jobFinished(p,!Backup.write(getApplicationContext())));return true;}
    public boolean onStopJob(JobParameters p){return true;}
}
