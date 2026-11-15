package at.misterx.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/**
 * Datei aus der App weitergeben (Video der Wiederholung, E-72): die WebView kann nichts herunterladen. Die Datei kommt
 * in Stücken („start“, „append“) in den Cache und geht dann über „Teilen“ an Galerie, Dateien, WhatsApp, Drive …
 */
@CapacitorPlugin(name = "Datei")
public class DateiPlugin extends Plugin {

    private File file;
    private FileOutputStream out;

    @PluginMethod
    public void start(PluginCall call) {
        try {
            if (out != null) out.close();
            File dir = new File(getContext().getCacheDir(), "teilen");
            dir.mkdirs();
            file = new File(dir, call.getString("name", "datei").replaceAll("[^A-Za-z0-9._-]+", "-"));
            out = new FileOutputStream(file);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void append(PluginCall call) {
        try {
            out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void teilen(PluginCall call) {
        try {
            out.close();
            out = null;
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(call.getString("typ", "application/octet-stream"));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, null);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
