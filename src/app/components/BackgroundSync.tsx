import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import {
  loadSyncQueue as dbLoadSyncQueue,
  saveSyncQueue as dbSaveSyncQueue,
  addToSyncQueue as dbAddToSyncQueue,
  type SyncQueueRecord,
} from "../utils/db";
import { storageGetJSON } from "../utils/safeStorage";

/**
 * 后台同步管理组件
 * 
 * 功能：
 * 1. 离线数据队列管理
 * 2. 网络恢复自动同步
 * 3. 同步状态显示
 * 4. 手动触发同步
 */

interface SyncItem {
  id: string;
  type: "comment" | "like" | "purchase" | "post" | "other";
  data: any;
  timestamp: number;
  status: "pending" | "syncing" | "success" | "failed";
  retryCount: number;
}

export function BackgroundSync() {
  const [isSupported, setIsSupported] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    const checkSupport = () => {
      const supported = 
        "serviceWorker" in navigator &&
        "sync" in ServiceWorkerRegistration.prototype;
      
      setIsSupported(supported);
    };

    checkSupport();
  }, []);

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("网络已恢复，准备同步数据...");
      triggerBackgroundSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("网络已断开，数据将在恢复后自动同步");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 从 localStorage 加载同步队列
  useEffect(() => {
    loadSyncQueue();

    // 定期检查队列
    const interval = setInterval(loadSyncQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  // 加载同步队列
  const loadSyncQueue = () => {
    dbLoadSyncQueue().then((records) => {
      const queue: SyncItem[] = records.map((r) => ({
        id: r.id,
        type: r.type as SyncItem["type"],
        data: typeof r.data === 'string' ? (() => { try { return JSON.parse(r.data); } catch { return r.data; } })() : r.data,
        timestamp: r.timestamp,
        status: r.status as SyncItem["status"],
        retryCount: r.retryCount,
      }));
      setSyncQueue(queue);
    }).catch((err) => {
      console.error("加载同步队列失败:", err);
      // Fallback to localStorage
      const stored = storageGetJSON<SyncItem[]>("taproot-sync-queue");
      if (stored) setSyncQueue(stored);
    });
  };

  // 保存同步队列
  const saveSyncQueue = (queue: SyncItem[]) => {
    setSyncQueue(queue);
    const records: SyncQueueRecord[] = queue.map((item) => ({
      id: item.id,
      type: item.type,
      data: JSON.stringify(item.data),
      timestamp: item.timestamp,
      status: item.status,
      retryCount: item.retryCount,
    }));
    dbSaveSyncQueue(records).catch((err) => {
      console.error("保存同步队列失败:", err);
    });
  };

  // 添加到同步队列
  const addToQueue = (type: SyncItem["type"], data: any) => {
    const newItem: SyncItem = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      data,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };

    const newQueue = [...syncQueue, newItem];
    saveSyncQueue(newQueue);

    // 如果在线，立即尝试同步
    if (isOnline) {
      triggerBackgroundSync();
    }
  };

  // 触发后台同步
  const triggerBackgroundSync = async () => {
    if (!isSupported) {
      // 降级到手动同步
      await manualSync();
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // 注册后台同步
      await registration.sync.register("sync-data");
      console.log("后台同步已注册");

      // 同时执行手动同步作为备用
      await manualSync();
    } catch (err) {
      console.error("注册后台同步失败:", err);
      // 降级到手动同步
      await manualSync();
    }
  };

  // 手动同步
  const manualSync = async () => {
    if (isSyncing || !isOnline) return;

    const pendingItems = syncQueue.filter(
      (item) => item.status === "pending" || item.status === "failed"
    );

    if (pendingItems.length === 0) return;

    setIsSyncing(true);

    try {
      // 逐个同步
      for (const item of pendingItems) {
        try {
          // 更新状态为同步中
          updateItemStatus(item.id, "syncing");

          // 发送到后端
          await syncToBackend(item);

          // 标记为成功
          updateItemStatus(item.id, "success");

          console.log(`同步成功: ${item.type}`, item.data);
        } catch (err) {
          console.error(`同步失败: ${item.type}`, err);

          // 增加重试次数
          const retryCount = item.retryCount + 1;

          // 超过3次失败则放弃
          if (retryCount >= 3) {
            updateItemStatus(item.id, "failed");
          } else {
            updateItemRetry(item.id, retryCount);
          }
        }
      }

      setLastSyncTime(new Date());

      // 清理成功的项目（保留最近10个）
      setTimeout(() => {
        cleanupSuccessItems();
      }, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // 同步到后端
  const syncToBackend = async (item: SyncItem) => {
    // 根据类型选择不同的API端点
    const endpoints: Record<SyncItem["type"], string> = {
      comment: "/api/comments",
      like: "/api/likes",
      purchase: "/api/purchases",
      post: "/api/posts",
      other: "/api/sync",
    };

    const endpoint = endpoints[item.type];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  };

  // 更新项目状态
  const updateItemStatus = (id: string, status: SyncItem["status"]) => {
    const newQueue = syncQueue.map((item) =>
      item.id === id ? { ...item, status } : item
    );
    saveSyncQueue(newQueue);
  };

  // 更新重试次数
  const updateItemRetry = (id: string, retryCount: number) => {
    const newQueue = syncQueue.map((item) =>
      item.id === id ? { ...item, retryCount, status: "pending" as const } : item
    );
    saveSyncQueue(newQueue);
  };

  // 清理成功的项目
  const cleanupSuccessItems = () => {
    const successItems = syncQueue.filter((item) => item.status === "success");
    
    if (successItems.length > 10) {
      // 只保留最新的10个成功项目
      const sortedSuccess = successItems.sort((a, b) => b.timestamp - a.timestamp);
      const toKeep = sortedSuccess.slice(0, 10);
      const toKeepIds = new Set(toKeep.map((item) => item.id));

      const newQueue = syncQueue.filter(
        (item) => item.status !== "success" || toKeepIds.has(item.id)
      );

      saveSyncQueue(newQueue);
    }
  };

  // 清除所有已完成项目
  const clearCompleted = () => {
    const newQueue = syncQueue.filter(
      (item) => item.status !== "success"
    );
    saveSyncQueue(newQueue);
  };

  // 重试失败项目
  const retryFailed = () => {
    const newQueue = syncQueue.map((item) =>
      item.status === "failed"
        ? { ...item, status: "pending" as const, retryCount: 0 }
        : item
    );
    saveSyncQueue(newQueue);
    triggerBackgroundSync();
  };

  // 统计
  const stats = {
    pending: syncQueue.filter((item) => item.status === "pending").length,
    syncing: syncQueue.filter((item) => item.status === "syncing").length,
    success: syncQueue.filter((item) => item.status === "success").length,
    failed: syncQueue.filter((item) => item.status === "failed").length,
  };

  // 不支持的浏览器
  if (!isSupported) {
    return (
      <div className="bg-yellow-50 rounded-lg" style={{ padding: "clamp(12px, 3vw, 16px)" }}>
        <div className="flex items-start" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
          <AlertCircle className="text-yellow-600 flex-shrink-0" style={{ width: "20px", height: "20px" }} />
          <div>
            <p className="text-yellow-800 font-medium" style={{ fontSize: "clamp(12px, 3.2vw, 14px)" }}>
              后台同步不可用
            </p>
            <p className="text-yellow-700" style={{ fontSize: "clamp(10px, 2.8vw, 12px)", marginTop: "4px" }}>
              当前浏览器不支持后台同步，数据将立即发送
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 网络状态 */}
      <div className={`rounded-lg ${isOnline ? "bg-emerald-50" : "bg-red-50"}`} style={{ padding: "clamp(12px, 3vw, 16px)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
            <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            <div>
              <p className={`font-medium ${isOnline ? "text-emerald-900" : "text-red-900"}`} style={{ fontSize: "clamp(12px, 3.2vw, 14px)" }}>
                {isOnline ? "网络正常" : "网络断开"}
              </p>
              <p className={`${isOnline ? "text-emerald-700" : "text-red-700"}`} style={{ fontSize: "clamp(10px, 2.8vw, 12px)", marginTop: "2px" }}>
                {isOnline ? "数据实时同步中" : "数据将在网络恢复后自动同步"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 同步统计 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-50 rounded-lg text-center" style={{ padding: "clamp(8px, 2vw, 10px)" }}>
          <Clock className="text-gray-400 mx-auto mb-1" style={{ width: "16px", height: "16px" }} />
          <p className="text-gray-900 font-bold" style={{ fontSize: "clamp(14px, 4vw, 18px)" }}>
            {stats.pending}
          </p>
          <p className="text-gray-600" style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}>
            待同步
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg text-center" style={{ padding: "clamp(8px, 2vw, 10px)" }}>
          <RefreshCw className="text-blue-500 mx-auto mb-1" style={{ width: "16px", height: "16px" }} />
          <p className="text-blue-900 font-bold" style={{ fontSize: "clamp(14px, 4vw, 18px)" }}>
            {stats.syncing}
          </p>
          <p className="text-blue-700" style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}>
            同步中
          </p>
        </div>

        <div className="bg-emerald-50 rounded-lg text-center" style={{ padding: "clamp(8px, 2vw, 10px)" }}>
          <CheckCircle className="text-emerald-500 mx-auto mb-1" style={{ width: "16px", height: "16px" }} />
          <p className="text-emerald-900 font-bold" style={{ fontSize: "clamp(14px, 4vw, 18px)" }}>
            {stats.success}
          </p>
          <p className="text-emerald-700" style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}>
            已完成
          </p>
        </div>

        <div className="bg-red-50 rounded-lg text-center" style={{ padding: "clamp(8px, 2vw, 10px)" }}>
          <AlertCircle className="text-red-500 mx-auto mb-1" style={{ width: "16px", height: "16px" }} />
          <p className="text-red-900 font-bold" style={{ fontSize: "clamp(14px, 4vw, 18px)" }}>
            {stats.failed}
          </p>
          <p className="text-red-700" style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}>
            失败
          </p>
        </div>
      </div>

      {/* 最后同步时间 */}
      {lastSyncTime && (
        <div className="text-center text-gray-600" style={{ fontSize: "clamp(10px, 2.8vw, 11px)" }}>
          最后同步: {lastSyncTime.toLocaleTimeString()}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex" style={{ gap: "clamp(8px, 2vw, 12px)" }}>
        <button
          onClick={manualSync}
          disabled={isSyncing || !isOnline || stats.pending === 0}
          className="flex-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
          style={{
            padding: "clamp(10px, 2.5vw, 12px)",
            fontSize: "clamp(12px, 3.2vw, 14px)",
            gap: "clamp(6px, 1.5vw, 8px)",
          }}
        >
          <RefreshCw style={{ width: "16px", height: "16px" }} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "同步中..." : "立即同步"}
        </button>

        {stats.failed > 0 && (
          <button
            onClick={retryFailed}
            disabled={isSyncing || !isOnline}
            className="flex-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            style={{
              padding: "clamp(10px, 2.5vw, 12px)",
              fontSize: "clamp(12px, 3.2vw, 14px)",
            }}
          >
            重试失败
          </button>
        )}

        {stats.success > 0 && (
          <button
            onClick={clearCompleted}
            className="bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            style={{
              padding: "clamp(10px, 2.5vw, 12px)",
              fontSize: "clamp(12px, 3.2vw, 14px)",
              minWidth: "80px",
            }}
          >
            清除
          </button>
        )}
      </div>

      {/* 说明文字 */}
      <div className="bg-blue-50 rounded-lg" style={{ padding: "clamp(10px, 2.5vw, 12px)" }}>
        <p className="text-blue-700" style={{ fontSize: "clamp(10px, 2.8vw, 11px)", lineHeight: "1.5" }}>
          💡 网络断开时，您的操作会自动保存，并在网络恢复后自动同步
        </p>
      </div>

      {/* 开发者工具 - 测试用 */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-purple-50 rounded-lg" style={{ padding: "clamp(10px, 2.5vw, 12px)" }}>
          <p className="text-purple-700 font-medium mb-2" style={{ fontSize: "clamp(11px, 3vw, 12px)" }}>
            🛠️ 开发者工具
          </p>
          <div className="flex flex-wrap" style={{ gap: "6px" }}>
            <button
              onClick={() => addToQueue("comment", { text: "测试评论" })}
              className="bg-purple-200 text-purple-800 rounded px-2 py-1"
              style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}
            >
              添加测试评论
            </button>
            <button
              onClick={() => addToQueue("like", { postId: "123" })}
              className="bg-purple-200 text-purple-800 rounded px-2 py-1"
              style={{ fontSize: "clamp(9px, 2.5vw, 10px)" }}
            >
              添加测试点赞
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 导出用于其他组件使用的工具函数
export const queueForSync = (type: SyncItem["type"], data: any) => {
  const newItem: SyncQueueRecord = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    data: JSON.stringify(data),
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  // Write to Dexie (async, fire-and-forget)
  dbAddToSyncQueue(newItem).catch((err) => {
    console.error("添加到同步队列失败:", err);
  });

  // 触发后台同步
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register("sync-data").catch(console.error);
    });
  }

  console.log("已添加到同步队列:", type, data);
};