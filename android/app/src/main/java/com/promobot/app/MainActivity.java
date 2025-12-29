package com.promobot.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.os.Handler;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private static final String BASE_URL = "https://promobot.store";
    private static final String AUTH_PATH = "/auth";
    private static final int SPLASH_DURATION = 4000; // 4 seconds
    private static final String TYPING_TEXT = "🚀 Автоматизація та просування Telegram-каналів";
    
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.splash_screen);
        
        ImageView splashIcon = findViewById(R.id.splash_icon);
        TextView typingText = findViewById(R.id.typing_text);
        ProgressBar progressBar = findViewById(R.id.progress_bar);
        TextView progressText = findViewById(R.id.progress_text);
        
        if (splashIcon != null) {
            Animation iconAnimation = AnimationUtils.loadAnimation(this, R.anim.splash_icon_animation);
            splashIcon.startAnimation(iconAnimation);
        }
        
        if (typingText != null) {
            startTypingAnimation(typingText, 400);
        }
        
        if (progressBar != null && progressText != null) {
            startProgressAnimation(progressBar, progressText);
        }
        
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                initWebView();
            }
        }, SPLASH_DURATION);
    }
    
    private void startTypingAnimation(final TextView textView, int delay) {
        new Handler().postDelayed(new Runnable() {
            int index = 0;
            
            @Override
            public void run() {
                if (index <= TYPING_TEXT.length()) {
                    textView.setText(TYPING_TEXT.substring(0, index));
                    index++;
                    new Handler().postDelayed(this, 40 + (int)(Math.random() * 20));
                }
            }
        }, delay);
    }
    
    private void startProgressAnimation(final ProgressBar progressBar, final TextView progressText) {
        new Handler().postDelayed(new Runnable() {
            int progress = 0;
            
            @Override
            public void run() {
                if (progress <= 100) {
                    progressBar.setProgress(progress);
                    progressText.setText(progress + "%");
                    progress += 2;
                    new Handler().postDelayed(this, 80); // 80ms * 50 steps = 4000ms
                }
            }
        }, 0);
    }
    
    private void initWebView() {
        // Preload layout without showing
        final android.view.View mainLayout = getLayoutInflater().inflate(R.layout.activity_main, null);
        
        webView = mainLayout.findViewById(R.id.webview);
        webView.setVisibility(android.view.View.INVISIBLE);
        setupWebView();
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Show WebView only when page is loaded
                webView.setVisibility(android.view.View.VISIBLE);
            }
            
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                android.util.Log.d("WebView", "Loading URL: " + url);
                
                // Open Google OAuth in Chrome browser (to show saved accounts)
                if (url.contains("accounts.google.com/o/oauth2")) {
                    try {
                        android.util.Log.d("WebView", "Opening Google OAuth in Chrome");
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        intent.setPackage("com.android.chrome"); // Force Chrome
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        android.util.Log.w("WebView", "Chrome not found, using default browser");
                        try {
                            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
                            startActivity(intent);
                            return true;
                        } catch (Exception e2) {
                            android.util.Log.e("WebView", "Failed to open browser", e2);
                            return false;
                        }
                    }
                }
                
                // Allow our domain and Supabase callback in WebView
                if (url.startsWith(BASE_URL) || 
                    url.contains("supabase.co") ||
                    url.contains("/auth/callback")) {
                    android.util.Log.d("WebView", "Loading in WebView");
                    return false; // Open in WebView
                }
                
                // Open t.me links in Telegram app
                if (url.contains("t.me")) {
                    try {
                        android.util.Log.d("WebView", "Opening Telegram link");
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        android.util.Log.e("WebView", "Failed to open Telegram", e);
                        return false;
                    }
                }
                
                android.util.Log.d("WebView", "Blocking external URL");
                return true;
            }
        });
        
        webView.loadUrl(BASE_URL + AUTH_PATH);
        
        // Set content view when page starts loading
        setContentView(mainLayout);
    }
    
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        
        // Disable all zoom
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(false);
        
        // Additional zoom prevention
        webSettings.setLoadWithOverviewMode(false);
        webSettings.setUseWideViewPort(false);
        
        webSettings.setDefaultTextEncodingName("utf-8");
        
        // Set User-Agent to Chrome Desktop to avoid Google OAuth 403 error
        String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        webSettings.setUserAgentString(userAgent);
        android.util.Log.d("WebView", "User-Agent set to: " + userAgent);
        
        // Cookie Manager with enhanced settings
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        
        // Enable cookie sync with Android system
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.flush();
        }
        
        android.util.Log.d("WebView", "Cookie settings enabled");
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith(BASE_URL)) {
                    return false;
                }
                return true;
            }
        });
    }
    
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
