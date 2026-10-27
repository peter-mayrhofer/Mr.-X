package at.rotefalken.misterx;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Akku-Optimierung (docs/ANDROID-APK.md): Android hält Apps im Hintergrund sonst an – dann kommen keine Standorte
 * mehr bei der Spielleitung an. „status“ fragt, ob die App ausgenommen ist, „request“ öffnet den System-Dialog.
 */
@CapacitorPlugin(name = "Akku")
public class AkkuPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("ignoring", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            // manche Hersteller kennen den direkten Dialog nicht → allgemeine Einstellungsseite
            Intent s = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(s);
        }
        call.resolve();
    }
}
