package at.misterx.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AkkuPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
