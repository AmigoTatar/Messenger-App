package com.potokmessenger.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import ru.rustore.sdk.pushclient.RuStorePushClient;

@CapacitorPlugin(name = "RuStorePush")
public class RuStorePushPlugin extends Plugin {

    @PluginMethod
    public void isConfigured(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("configured", isSdkConfigured());
        call.resolve(ret);
    }

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        if (!isSdkConfigured()) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            ret.put("reason", "not_configured");
            call.resolve(ret);
            return;
        }

        try {
            RuStorePushClient.INSTANCE.checkPushAvailability()
                    .addOnSuccessListener(result -> {
                        JSObject ret = new JSObject();
                        boolean available = result != null
                                && "Available".equals(result.getClass().getSimpleName());
                        ret.put("available", available);
                        if (!available) {
                            ret.put("reason", "unavailable");
                        }
                        call.resolve(ret);
                    })
                    .addOnFailureListener(err -> {
                        JSObject ret = new JSObject();
                        ret.put("available", false);
                        ret.put("reason", err != null ? err.getMessage() : "unknown");
                        call.resolve(ret);
                    });
        } catch (Throwable t) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            ret.put("reason", t.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        if (!isSdkConfigured()) {
            call.reject("RuStore projectId не задан (strings.xml rustore_project_id)");
            return;
        }

        try {
            RuStorePushClient.INSTANCE.getToken()
                    .addOnSuccessListener(token -> {
                        JSObject ret = new JSObject();
                        ret.put("token", token);
                        call.resolve(ret);
                    })
                    .addOnFailureListener(err ->
                            call.reject(err != null ? String.valueOf(err.getMessage()) : "getToken failed")
                    );
        } catch (Throwable t) {
            call.reject(t.getMessage() != null ? t.getMessage() : "getToken failed");
        }
    }

    @PluginMethod
    public void deleteToken(PluginCall call) {
        if (!isSdkConfigured()) {
            call.resolve();
            return;
        }

        try {
            RuStorePushClient.INSTANCE.deleteToken()
                    .addOnSuccessListener(ignored -> call.resolve())
                    .addOnFailureListener(err ->
                            call.reject(err != null ? String.valueOf(err.getMessage()) : "deleteToken failed")
                    );
        } catch (Throwable t) {
            call.reject(t.getMessage() != null ? t.getMessage() : "deleteToken failed");
        }
    }

    private boolean isSdkConfigured() {
        try {
            String projectId = getContext().getString(R.string.rustore_project_id);
            return projectId != null && !projectId.isEmpty() && !"REPLACE_ME".equals(projectId);
        } catch (Exception e) {
            return false;
        }
    }
}
