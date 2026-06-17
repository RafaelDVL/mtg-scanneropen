package mtg.scanneropen;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        WebView wv = getBridge().getWebView();
        if (wv != null) {
            wv.setBackgroundColor(Color.TRANSPARENT);
        }
    }
}
