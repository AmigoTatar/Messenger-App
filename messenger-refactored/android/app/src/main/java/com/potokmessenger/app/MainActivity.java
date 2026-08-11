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

        // Получаем WebView (для работы с навигацией)
        webView = (WebView) this.bridge.getWebView();

        // Обработка кнопки "Назад" в Android
        // Переопределяем поведение: если есть история — идём назад, иначе — закрываем приложение
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Можно перехватывать ссылки, если нужно
                return false;
            }
        });
    }

    // Переопределяем обработку кнопки "Назад"
    @Override
    public void onBackPressed() {
        // Проверяем, может ли WebView идти назад
        if (webView != null && webView.canGoBack()) {
            webView.goBack(); // Идём назад в истории
        } else {
            // Если истории нет — закрываем приложение (стандартное поведение)
            super.onBackPressed();
        }
    }
}