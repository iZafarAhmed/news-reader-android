package com.example.newsreader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private WebView web;
    private WebView browser;
    private View browserBox;
    private TextView barTitle;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
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
                openBrowser(url);
                return true;
            }
        });

        browser = new WebView(this);
        WebSettings bs = browser.getSettings();
        bs.setJavaScriptEnabled(true);
        bs.setDomStorageEnabled(true);
        bs.setUseWideViewPort(true);
        bs.setLoadWithOverviewMode(true);
        browser.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                barTitle.setText(url.replace("https://", "").replace("http://", ""));
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String u = request.getUrl().toString();
                if (u.startsWith("http://") || u.startsWith("https://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception e) {}
                return true;
            }
        });

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setBackgroundColor(0xFFFFFFFF);
        bar.setElevation(6);
        bar.addView(barButton("✕", v -> closeBrowser()));
        bar.addView(barButton("←", v -> { if (browser.canGoBack()) browser.goBack(); }));
        barTitle = new TextView(this);
        barTitle.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        barTitle.setPadding(12, 12, 12, 12);
        barTitle.setMaxLines(1);
        barTitle.setEllipsize(TextUtils.TruncateAt.MIDDLE);
        barTitle.setTextSize(12);
        barTitle.setTextColor(0xFF666666);
        bar.addView(barTitle);
        bar.addView(barButton("↗", v -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(browser.getUrl()))); } catch (Exception e) {}
        }));

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(0xFFFFFFFF);
        box.setVisibility(View.GONE);
        box.addView(bar);
        box.addView(browser, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        browserBox = box;

        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(box, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        web.loadUrl("file:///android_asset/popup.html");
    }

    private Button barButton(String txt, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(txt);
        b.setBackgroundColor(0x00000000);
        b.setTextColor(0xFF1A73E8);
        b.setTextSize(16);
        b.setMinWidth(0); b.setMinimumWidth(0);
        b.setPadding(28, 8, 28, 8);
        b.setOnClickListener(l);
        return b;
    }

    private void openBrowser(String url) {
        browserBox.setVisibility(View.VISIBLE);
        browser.loadUrl(url);
    }
    private void closeBrowser() {
        browser.stopLoading();
        browserBox.setVisibility(View.GONE);
        browser.loadUrl("about:blank");
    }

    @Override
    public void onBackPressed() {
        if (browserBox.getVisibility() == View.VISIBLE) {
            if (browser.canGoBack()) browser.goBack(); else closeBrowser();
            return;
        }
        web.evaluateJavascript(
            "(function(){" +
            "var r=document.getElementById('reader');" +
            "if(r&&r.classList.contains('open')){r.classList.remove('open');return 'reader';}" +
            "var sh=document.getElementById('sheet');" +
            "if(sh&&sh.style.display==='block'){sh.style.display='none';document.getElementById('scrim').style.display='none';return 'sheet';}" +
            "return 'none';})()",
            value -> {
                String v = value == null ? "none" : value.replace("\"", "");
                if ("none".equals(v)) runOnUiThread(() -> {
                    if (web.canGoBack()) web.goBack(); else finish();
                });
            });
    }

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
                    if (code >= 400) out = "{\"http_status\":" + code + "}";
                    else {
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

        /** NEW: follow Google's 302 and return the real publisher URL (never downloads the article). */
        @JavascriptInterface
        public void resolveRedirect(final String url, final String cb) {
            new Thread(() -> {
                String out = url;
                try {
                    String u = url;
                    for (int i = 0; i < 3; i++) {
                        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(10000);
                        c.setReadTimeout(10000);
                        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36");
                        int code = c.getResponseCode();
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (code >= 300 && code < 400 && loc != null) u = loc; else break;
                    }
                    out = u;
                } catch (Exception e) { /* keep original on failure */ }
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
