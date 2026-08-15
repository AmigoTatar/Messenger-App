package com.potokmessenger.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.util.Log;

import ru.rustore.sdk.pushclient.RuStorePushClient;
import ru.rustore.sdk.pushclient.common.logger.DefaultLogger;

public class PotokApplication extends Application {
    private static final String TAG = "PotokRuStore";
    public static final String CHANNEL_ID = "potok_messages";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureNotificationChannel();

        String projectId = getString(R.string.rustore_project_id);
        if (projectId == null || projectId.isEmpty() || "REPLACE_ME".equals(projectId)) {
            Log.w(TAG, "RuStore projectId не задан (strings.xml rustore_project_id) — SDK не инициализирован");
            return;
        }

        try {
            RuStorePushClient.INSTANCE.init(
                    this,
                    projectId,
                    new DefaultLogger(TAG)
            );
            Log.i(TAG, "RuStore Push SDK init OK");
        } catch (Throwable t) {
            Log.e(TAG, "RuStore Push SDK init failed", t);
        }
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Сообщения",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Уведомления о новых сообщениях");
        nm.createNotificationChannel(channel);
    }
}
