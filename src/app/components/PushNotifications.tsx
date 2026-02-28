import { useState, useEffect } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";

/**
 * 推送通知管理组件
 * 
 * 功能：
 * 1. 请求推送权限
 * 2. 订阅推送服务
 * 3. 显示通知状态
 * 4. 取消订阅
 */

interface PushNotificationsProps {
  onSubscriptionChange?: (subscription: PushSubscription | null) => void;
}

export function PushNotifications({ onSubscriptionChange }: PushNotificationsProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSupported, setIsSupported] = useState(true);

  // 检查浏览器支持
  useEffect(() => {
    const checkSupport = () => {
      const supported = 
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
        checkExistingSubscription();
      }
    };

    checkSupport();
  }, []);

  // 检查现有订阅
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        setSubscription(existingSubscription);
        onSubscriptionChange?.(existingSubscription);
      }
    } catch (err) {
      console.error("检查订阅失败:", err);
    }
  };

  // 请求推送权限
  const requestPermission = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        await subscribeToPush();
      } else if (result === "denied") {
        setError("推送权限被拒绝，请在浏览器设置中允许通知");
      }
    } catch (err) {
      console.error("请求权限失败:", err);
      setError("请求权限失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 订阅推送服务
  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      // VAPID 公钥 (需要从后端获取或配置)
      // 这是一个示例，实际应用中需要使用你自己的密钥
      const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || 
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrII6O28PGo7B1vI-B-6jLmEDWHlJMW5XZdPTHm5m8WwjKZkZvQ";

      // 将 base64 字符串转换为 Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // 订阅推送
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      setSubscription(pushSubscription);
      onSubscriptionChange?.(pushSubscription);

      // 发送订阅信息到后端
      await sendSubscriptionToBackend(pushSubscription);

      console.log("推送订阅成功:", pushSubscription);
    } catch (err) {
      console.error("订阅推送失败:", err);
      setError("订阅推送失败，请重试");
    }
  };

  // 取消订阅
  const unsubscribe = async () => {
    if (!subscription) return;

    setLoading(true);
    setError("");

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      onSubscriptionChange?.(null);

      // 通知后端删除订阅
      await removeSubscriptionFromBackend(subscription);

      console.log("取消订阅成功");
    } catch (err) {
      console.error("取消订阅失败:", err);
      setError("取消订阅失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 发送订阅到后端
  const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
    try {
      // 替换为你的后端API地址
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("保存订阅失败");
      }

      console.log("订阅已保存到后端");
    } catch (err) {
      console.error("保存订阅到后端失败:", err);
      // 不影响前端订阅，只记录错误
    }
  };

  // 从后端删除订阅
  const removeSubscriptionFromBackend = async (subscription: PushSubscription) => {
    try {
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("删除订阅失败");
      }

      console.log("订阅已从后端删除");
    } catch (err) {
      console.error("从后端删除订阅失败:", err);
    }
  };

  // 测试推送通知
  const testNotification = () => {
    if (permission !== "granted") {
      setError("请先允许推送通知");
      return;
    }

    new Notification("TaprootAgro 测试通知", {
      body: "这是一条测试推送通知 🌱",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "test-notification",
      vibrate: [200, 100, 200],
    });
  };

  // 不支持的浏览器
  if (!isSupported) {
    return (
      <div className="bg-yellow-50 rounded-lg" style={{ padding: "clamp(12px, 3vw, 16px)" }}>
        <div className="flex items-start" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
          <BellOff className="text-yellow-600 flex-shrink-0" style={{ width: "20px", height: "20px" }} />
          <div>
            <p className="text-yellow-800 font-medium" style={{ fontSize: "clamp(12px, 3.2vw, 14px)" }}>
              推送通知不可用
            </p>
            <p className="text-yellow-700" style={{ fontSize: "clamp(10px, 2.8vw, 12px)", marginTop: "4px" }}>
              当前浏览器不支持推送通知功能
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 状态显示 */}
      <div className="bg-gray-50 rounded-lg" style={{ padding: "clamp(12px, 3vw, 16px)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
            {subscription ? (
              <Bell className="text-emerald-600" style={{ width: "20px", height: "20px" }} />
            ) : (
              <BellOff className="text-gray-400" style={{ width: "20px", height: "20px" }} />
            )}
            <div>
              <p className="text-gray-900 font-medium" style={{ fontSize: "clamp(12px, 3.2vw, 14px)" }}>
                推送通知
              </p>
              <p className="text-gray-600" style={{ fontSize: "clamp(10px, 2.8vw, 12px)", marginTop: "2px" }}>
                {subscription ? "已开启" : permission === "denied" ? "已拒绝" : "未开启"}
              </p>
            </div>
          </div>

          {/* 状态图标 */}
          {subscription && (
            <div className="bg-emerald-100 rounded-full" style={{ padding: "4px" }}>
              <Check className="text-emerald-600" style={{ width: "16px", height: "16px" }} />
            </div>
          )}
          {permission === "denied" && (
            <div className="bg-red-100 rounded-full" style={{ padding: "4px" }}>
              <X className="text-red-600" style={{ width: "16px", height: "16px" }} />
            </div>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-50 rounded-lg" style={{ padding: "clamp(10px, 2.5vw, 12px)" }}>
          <p className="text-red-600" style={{ fontSize: "clamp(10px, 2.8vw, 12px)" }}>
            {error}
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
        {!subscription ? (
          <button
            onClick={requestPermission}
            disabled={loading || permission === "denied"}
            className="flex-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            style={{
              padding: "clamp(10px, 2.5vw, 12px)",
              fontSize: "clamp(12px, 3.2vw, 14px)",
            }}
          >
            {loading ? "正在开启..." : "开启推送通知"}
          </button>
        ) : (
          <>
            <button
              onClick={testNotification}
              className="flex-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              style={{
                padding: "clamp(10px, 2.5vw, 12px)",
                fontSize: "clamp(12px, 3.2vw, 14px)",
              }}
            >
              测试通知
            </button>
            <button
              onClick={unsubscribe}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
              style={{
                padding: "clamp(10px, 2.5vw, 12px)",
                fontSize: "clamp(12px, 3.2vw, 14px)",
              }}
            >
              {loading ? "正在关闭..." : "关闭通知"}
            </button>
          </>
        )}
      </div>

      {/* 说明文字 */}
      <div className="bg-blue-50 rounded-lg" style={{ padding: "clamp(10px, 2.5vw, 12px)" }}>
        <p className="text-blue-700" style={{ fontSize: "clamp(10px, 2.8vw, 11px)", lineHeight: "1.5" }}>
          💡 开启后，您将收到：农业资讯、天气预警、订单提醒等重要通知
        </p>
      </div>
    </div>
  );
}

// 工具函数：将 base64 字符串转换为 Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
