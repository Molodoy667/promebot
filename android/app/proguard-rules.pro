# WebView
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn android.webkit.**
-keep class android.webkit.** { *; }
