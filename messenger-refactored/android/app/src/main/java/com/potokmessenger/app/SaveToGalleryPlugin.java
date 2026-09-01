package com.potokmessenger.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.MimeTypeMap;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "SaveToGallery")
public class SaveToGalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String path = call.getString("path");
        String fileName = call.getString("fileName", "potok.jpg");
        if (path == null || path.isEmpty()) {
            call.reject("Нет файла");
            return;
        }

        File src = fileFromPath(path);
        if (src == null || !src.exists() || !src.isFile()) {
            call.reject("Файл не найден");
            return;
        }

        String mime = mimeFromName(fileName);
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, mime);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/Potok"
                );
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            Uri item = getContext().getContentResolver().insert(collection, values);
            if (item == null) {
                call.reject("Не удалось создать файл в галерее");
                return;
            }

            try (FileInputStream in = new FileInputStream(src);
                 OutputStream out = getContext().getContentResolver().openOutputStream(item)) {
                if (out == null) {
                    call.reject("Не удалось записать в галерею");
                    return;
                }
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(item, values, null, null);
            }

            JSObject ret = new JSObject();
            ret.put("uri", item.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Ошибка сохранения");
        }
    }

    private File fileFromPath(String path) {
        if (path.startsWith("file:")) {
            String p = Uri.parse(path).getPath();
            return p != null ? new File(p) : null;
        }
        return new File(path);
    }

    private String mimeFromName(String name) {
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot >= 0 && dot < name.length() - 1) {
            ext = name.substring(dot + 1).toLowerCase();
        }
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "image/jpeg";
    }
}
