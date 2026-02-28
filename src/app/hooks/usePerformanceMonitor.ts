import { useEffect } from "react";

/**
 * 性能监控Hook - 针对老设备
 * 
 * 功能：
 * - 监控页面加载性能
 * - 检测低端设备
 * - 在控制台输出性能报告
 */
export function usePerformanceMonitor(pageName: string) {
  useEffect(() => {
    // 检查是否为低端设备
    const isLowEndDevice = () => {
      // 检查硬件并发数（CPU核心数）
      const hardwareConcurrency = navigator.hardwareConcurrency || 2;
      
      // 检查设备内存（如果可用）
      const deviceMemory = (navigator as any).deviceMemory || 4;
      
      // 低端设备判断：CPU <= 4核 或 内存 <= 2GB
      return hardwareConcurrency <= 4 || deviceMemory <= 2;
    };

    // 获取性能指标
    const getPerformanceMetrics = () => {
      if (!window.performance || !window.performance.timing) {
        return null;
      }

      const timing = window.performance.timing;
      const navigation = window.performance.navigation;

      return {
        // DNS查询耗时
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        
        // TCP连接耗时
        tcp: timing.connectEnd - timing.connectStart,
        
        // 请求耗时
        request: timing.responseEnd - timing.requestStart,
        
        // 响应耗时
        response: timing.responseEnd - timing.responseStart,
        
        // DOM解析耗时
        domParse: timing.domInteractive - timing.domLoading,
        
        // DOM就绪耗时
        domReady: timing.domContentLoadedEventEnd - timing.fetchStart,
        
        // 页面完全加载耗时
        load: timing.loadEventEnd - timing.fetchStart,
        
        // 首字节时间 (TTFB)
        ttfb: timing.responseStart - timing.fetchStart,
        
        // 白屏时间
        whiteScreen: timing.domLoading - timing.fetchStart,
        
        // 导航类型
        navType: navigation.type === 0 ? '正常导航' : 
                 navigation.type === 1 ? '刷新' : 
                 navigation.type === 2 ? '后退/前进' : '其他',
      };
    };

    // 延迟执行，确保页面加载完成
    const timer = setTimeout(() => {
      const metrics = getPerformanceMetrics();
      const isLowEnd = isLowEndDevice();

      if (metrics) {
        console.group(`📊 性能报告 - ${pageName}`);
        console.log(`🖥️  设备类型: ${isLowEnd ? '⚠️  低端设备' : '✅ 正常设备'}`);
        console.log(`🌐 DNS查询: ${metrics.dns}ms`);
        console.log(`🔌 TCP连接: ${metrics.tcp}ms`);
        console.log(`📡 TTFB: ${metrics.ttfb}ms ${metrics.ttfb > 600 ? '⚠️  较慢' : '✅'}`);
        console.log(`⚪ 白屏时间: ${metrics.whiteScreen}ms ${metrics.whiteScreen > 1000 ? '⚠️  较慢' : '✅'}`);
        console.log(`📄 DOM就绪: ${metrics.domReady}ms ${metrics.domReady > 2000 ? '⚠️  较慢' : '✅'}`);
        console.log(`✅ 完全加载: ${metrics.load}ms ${metrics.load > 3000 ? '⚠️  较慢' : '✅'}`);
        console.log(`🧭 导航类型: ${metrics.navType}`);
        
        // 性能评分
        let score = 100;
        if (metrics.ttfb > 600) score -= 10;
        if (metrics.whiteScreen > 1000) score -= 15;
        if (metrics.domReady > 2000) score -= 15;
        if (metrics.load > 3000) score -= 20;
        if (isLowEnd) score -= 10;
        
        const getGrade = (s: number) => {
          if (s >= 90) return { grade: 'A', emoji: '🏆', color: '#10b981' };
          if (s >= 80) return { grade: 'B', emoji: '👍', color: '#3b82f6' };
          if (s >= 70) return { grade: 'C', emoji: '⚠️ ', color: '#f59e0b' };
          return { grade: 'D', emoji: '❌', color: '#ef4444' };
        };
        
        const grade = getGrade(score);
        console.log(`%c${grade.emoji} 性能评分: ${score}/100 (${grade.grade}级)`, `color: ${grade.color}; font-weight: bold; font-size: 14px;`);
        console.groupEnd();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pageName]);
}
