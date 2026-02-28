/**
 * 检查用户是否已登录
 * @returns {boolean} 返回登录状态
 */
export function isUserLoggedIn(): boolean {
  return localStorage.getItem("isLoggedIn") === "true";
}

/**
 * 设置用户登录状态
 * @param {boolean} status - 登录状态
 */
export function setUserLoggedIn(status: boolean): void {
  if (status) {
    localStorage.setItem("isLoggedIn", "true");
  } else {
    localStorage.removeItem("isLoggedIn");
  }
}

/**
 * 检查是否需要登录，如果未登录则导航到登录页
 * @param {Function} navigate - React Router 的 navigate 函数
 * @param {Function} callback - 登录后执行的回调函数
 * @returns {boolean} 返回是否已登录
 */
export function requireLogin(
  navigate: (path: string) => void,
  callback?: () => void
): boolean {
  const loggedIn = isUserLoggedIn();
  
  if (!loggedIn) {
    navigate("/login");
    return false;
  }
  
  if (callback) {
    callback();
  }
  
  return true;
}
