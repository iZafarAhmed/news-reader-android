package com.example.newsreader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://news.google.com/")) return fetchNative(url);
                return super.shouldInterceptRequest(view, request);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) {}
                return true;
            }
        });

        web.loadUrl("file:///android_asset/popup.html");
    }

    /** Back = close reader → close sheet → exit app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){" +
            "var r=document.getElementById('reader');" +
            "if(r&&r.classList.contains('open')){r.classList.remove('open');return 'reader';}" +
            "var sh=document.getElementById('sheet');" +
            "if(sh&&sh.style.display==='block'){sh.style.display='none';document.getElementById('scrim').style.display='none';return 'sheet';}" +
            "return 'none';})()",
            value -> {
                String v = value == null ? "none" : value.replace("\"", "");
                if ("none".equals(v)) {
                    runOnUiThread(() -> {
                        if (web.canGoBack()) web.goBack(); else finish();
                    });
                }
            });
    }

    /** Native POST for the NVIDIA API (bypasses WebView CORS). */
    public class Bridge {
        @JavascriptInterface
        public void postJson(final String url, final String token, final String body, final String cb) {
            new Thread(() -> {
                String out;
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(180000);
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setRequestProperty("Authorization", "Bearer " + token);
                    c.getOutputStream().write(body.getBytes("UTF-8"));
                    int code = c.getResponseCode();
                    if (code >= 400) {
                        out = "{\"http_status\":" + code + "}";
                    } else {
                        InputStream in = c.getInputStream();
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        byte[] buf = new byte[4096]; int n;
                        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                        out = bo.toString("UTF-8");
                    }
                } catch (Exception e) {
                    String msg = e.getMessage() == null ? e.toString() : e.getMessage();
                    out = "{\"error\":\"" + msg.replace("\"", "'") + "\"}";
                }
                final String js = cb + "(" + JSONObject.quote(out) + ");";
                web.post(() -> web.evaluateJavascript(js, null));
            }).start();
        }
    }

    private WebResourceResponse fetchNative(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36");
            String msg = c.getResponseMessage(); if (msg == null) msg = "OK";
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse("application/xml", "utf-8", c.getResponseCode(), msg, headers, c.getInputStream());
        } catch (Exception e) { return null; }
    }
}
