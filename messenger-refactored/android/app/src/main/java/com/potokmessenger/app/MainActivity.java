package com.potokmessenger.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;


public class MainActivity extends BridgeActivity {

    private WebView webView;

    @Override
     public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Включаем веб-отладку (без этого Chrome не увидит приложение)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            android.webkit.WebView.setWebContentsDebuggingEnabled(true);
        }
        
        // Получаем WebView (для работы с навигацией)
        webView = (WebView) this.bridge.getWebView();

        // Обработка кнопки "Назад" в Android
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Можно перехватывать ссылки, если нужно
                return false;
            }
        });
    }



}