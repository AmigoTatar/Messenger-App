package com.potokmessenger.app;

import android.util.Log;

import java.util.List;

import ru.rustore.sdk.pushclient.messaging.exception.RuStorePushClientException;
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage;
import ru.rustore.sdk.pushclient.messaging.service.RuStoreMessagingService;

/**
 * Если в payload есть notification — SDK сам рисует баннер.
 * Токен JS забирает через getToken() при логине / session restore.
 */
public class PotokRuStoreMessagingService extends RuStoreMessagingService {
    private static final String TAG = "PotokRuStore";

    @Override
    public void onNewToken(String token) {
        Log.i(TAG, "onNewToken: " + (token != null ? token.substring(0, Math.min(12, token.length())) : "null") + "…");
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Log.i(TAG, "onMessageReceived id=" + (message != null ? message.getMessageId() : "null"));
    }

    @Override
    public void onDeletedMessages() {
        Log.w(TAG, "onDeletedMessages — часть пушей не доехала");
    }

    @Override
    public void onError(List<? extends RuStorePushClientException> errors) {
        if (errors == null) return;
        for (RuStorePushClientException err : errors) {
            Log.e(TAG, "onError: " + err.getClass().getSimpleName() + " " + err.getMessage());
        }
    }
}
