import { useState } from "react";
import { useNavigate } from "react-router";
import { X, Smartphone, MessageSquare, Mail } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { setUserLoggedIn } from "../utils/auth";
import { useHomeConfig } from "../hooks/useHomeConfig";

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config } = useHomeConfig();
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleLogin = () => {
    if (!agreed) {
      alert(t.login.agreeFirst);
      return;
    }
    setUserLoggedIn(true);
    // 登录成功后返回到个人中心
    navigate("/home/profile");
  };

  const handleSocialLogin = (platform: string) => {
    if (!agreed) {
      alert(t.login.agreeFirst);
      return;
    }
    setUserLoggedIn(true);
    // 登录成功后返回到个人中心
    navigate("/home/profile");
  };

  return (
    <div className="min-h-full bg-white flex flex-col px-[5vw] py-[2vh] relative overflow-y-auto">
      <button
        onClick={() => navigate("/home")}
        className="absolute top-[2vh] right-[3vw] text-gray-600 active:bg-gray-200 p-[1vw] rounded-full transition-colors touch-manipulation z-10"
        style={{ width: 'clamp(20px, 7vw, 32px)', height: 'clamp(20px, 7vw, 32px)' }}
      >
        <X style={{ width: '100%', height: '100%' }} />
      </button>

      <div className="w-full" style={{ maxWidth: 'min(90vw, 400px)', marginTop: 'clamp(20px, 4vh, 30px)', marginBottom: 'clamp(15px, 3vh, 20px)' }}>
        <div className="flex items-center" style={{ gap: 'clamp(10px, 2.5vw, 14px)' }}>
          <div 
            className="bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden"
            style={{ width: 'clamp(48px, 14vw, 64px)', height: 'clamp(48px, 14vw, 64px)', borderRadius: 'clamp(10px, 2.5vw, 14px)' }}
          >
            {config?.appBranding?.logoUrl ? (
              <img 
                src={config.appBranding.logoUrl} 
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-emerald-600 font-bold" style={{ fontSize: 'clamp(22px, 8vw, 36px)' }}>农</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-gray-900 font-bold leading-tight" style={{ fontSize: 'clamp(14px, 4.5vw, 20px)', marginBottom: 'clamp(1px, 0.3vh, 4px)' }}>{config?.appBranding?.appName || "TaprootAgro"}</h1>
            <p className="text-gray-500 leading-snug" style={{ fontSize: 'clamp(8px, 2.4vw, 12px)' }}>{config?.appBranding?.slogan || "To be the taproot of smart agro."}</p>
          </div>
        </div>
      </div>

      <div className="w-full" style={{ maxWidth: 'min(90vw, 400px)' }}>
        <div className="bg-gray-50 rounded-xl" style={{ padding: 'clamp(12px, 3vw, 16px)', marginBottom: 'clamp(12px, 3vh, 16px)', borderRadius: 'clamp(10px, 2.5vw, 14px)' }}>
          <h3 className="text-gray-700 text-center font-medium" style={{ fontSize: 'clamp(11px, 3.2vw, 13px)', marginBottom: 'clamp(10px, 2.5vh, 14px)' }}>{t.login.quickLogin}</h3>
          
          <div className="flex items-center justify-center" style={{ gap: 'clamp(10px, 3vw, 14px)', marginBottom: 'clamp(8px, 2vh, 12px)' }}>
            <button onClick={() => handleSocialLogin("wechat")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-[#07C160] rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 1000 1000" className="fill-white" style={{ width: '60%', height: '60%' }}>
                  <path d="M385.7 512.5c-23.8 0-47.6-15.9-47.6-39.7 0-23.8 23.8-39.7 47.6-39.7 23.8 0 39.7 15.9 39.7 39.7 0 23.8-15.9 39.7-39.7 39.7zm-176.4 0c-23.8 0-47.6-15.9-47.6-39.7 0-23.8 23.8-39.7 47.6-39.7s39.7 15.9 39.7 39.7c0 23.8-15.9 39.7-39.7 39.7z"/><path d="M321.4 117.5C143.3 117.5 0 238.1 0 388.1c0 87.3 47.6 158.7 126.9 214.3l-31.7 95.2 110.7-55.4c39.7 7.9 71.4 15.9 110.7 15.9 7.9 0 15.9 0 23.8-.8-5-16.9-7.9-34.6-7.9-53.2 0-141.8 126.9-257.1 285.7-257.1 9 0 17.9.5 26.7 1.4C600.6 209.5 472.6 117.5 321.4 117.5z"/><path d="M880.9 630.9c0-126.9-126.9-230.4-269.8-230.4-150.7 0-270.6 103.5-270.6 230.4 0 126.9 119.9 230.4 270.6 230.4 31.7 0 63.5-7.9 95.2-15.9l87.3 47.6-23.8-79.4c63.5-47.5 111.1-111 111.1-182.7zm-357.1-39.7c-15.9 0-31.7-15.9-31.7-31.7 0-15.9 15.9-31.7 31.7-31.7 23.8 0 39.7 15.9 39.7 31.7 0 15.9-15.9 31.7-39.7 31.7zm174.7 0c-15.9 0-31.7-15.9-31.7-31.7 0-15.9 15.9-31.7 31.7-31.7 23.8 0 39.7 15.9 39.7 31.7 0 15.9-15.9 31.7-39.7 31.7z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.wechat}</span>
            </button>
            <button onClick={() => handleSocialLogin("google")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-white rounded-full flex items-center justify-center shadow-sm" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 24 24" style={{ width: '70%', height: '70%' }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.google}</span>
            </button>
            <button onClick={() => handleSocialLogin("facebook")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-[#1877F2] rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 24 24" className="fill-white" style={{ width: '50%', height: '50%' }}>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.facebook}</span>
            </button>
            <button onClick={() => handleSocialLogin("apple")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-black rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 24 24" className="fill-white" style={{ width: '65%', height: '65%' }}>
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.apple}</span>
            </button>
          </div>

          <div className="flex items-center justify-center" style={{ gap: 'clamp(10px, 3vw, 14px)' }}>
            <button onClick={() => handleSocialLogin("alipay")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-[#1678FF] rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 1024 1024" className="fill-white" style={{ width: '55%', height: '55%' }}>
                  <path d="M1024 701.9v160.5c0 88.9-72.2 161.1-161.1 161.1H161.1C72.2 1023.5 0 951.3 0 862.4V161.1C0 72.2 72.2 0 161.1 0h701.8c88.9 0 161.1 72.2 161.1 161.1v540.8zM911.9 680c-34.8-19.5-95.4-49.4-209.8-49.4-131.8 0-195.5 38.5-236.7 62.7-54.8-78.5-97.7-171.9-120.8-256h303.3v-53.6H427.8v-80.3h-53.6v80.3H154.1v53.6h436.8c20.9 75.8 57.9 159.8 107.6 235.3-83.1 41.9-139.2 102.5-139.2 167.5 0 80.3 80.3 107.6 134.4 107.6 74.9 0 139.2-53.6 180.5-129.1 50.3 27.5 105.4 48.5 148.3 68.9l22.2-78.1z m-478.5 91.2c-37.6 0-80.3-14.2-80.3-53.6 0-43.5 48.5-87.6 116.2-120.8 24.5 43.5 50.3 85.4 77.2 124.4-29.8 32.9-72.6 50-113.1 50z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.alipay}</span>
            </button>
            <button onClick={() => handleSocialLogin("twitter")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-black rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 24 24" className="fill-white" style={{ width: '55%', height: '55%' }}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.twitter}</span>
            </button>
            <button onClick={() => handleSocialLogin("line")} className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity">
              <div className="bg-[#00B900] rounded-full flex items-center justify-center" style={{ width: 'clamp(32px, 9vw, 42px)', height: 'clamp(32px, 9vw, 42px)' }}>
                <svg viewBox="0 0 24 24" className="fill-white" style={{ width: '65%', height: '65%' }}>
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
              </div>
              <span className="text-gray-600" style={{ fontSize: 'clamp(8px, 2.2vw, 9px)' }}>{t.login.line}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center" style={{ marginBottom: 'clamp(12px, 3vh, 16px)' }}>
          <div className="flex items-start" style={{ gap: 'clamp(5px, 1.5vw, 8px)' }}>
            <input type="checkbox" id="agreement" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 rounded accent-emerald-600 flex-shrink-0" style={{ width: 'clamp(12px, 3.5vw, 16px)', height: 'clamp(12px, 3.5vw, 16px)' }} />
            <label htmlFor="agreement" className="text-gray-600 leading-tight" style={{ fontSize: 'clamp(9px, 2.5vw, 11px)' }}>
              {t.login.agreeTerms}
              <span className="underline mx-0.5 text-emerald-600">{t.login.userAgreement}</span>
              {t.login.and}
              <span className="underline ml-0.5 text-emerald-600">{t.login.privacyPolicy}</span>
            </label>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl" style={{ padding: 'clamp(12px, 3vw, 16px)', borderRadius: 'clamp(10px, 2.5vw, 14px)' }}>
          <h3 className="text-gray-700 text-center font-medium" style={{ fontSize: 'clamp(11px, 3.2vw, 13px)', marginBottom: 'clamp(10px, 2.5vh, 14px)' }}>{t.login.accountLogin}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1.5vh, 8px)' }}>
            <div className="flex items-center" style={{ gap: 'clamp(5px, 1.5vw, 8px)' }}>
              <button onClick={() => setLoginMethod("phone")} className={`flex-1 flex items-center justify-center ${loginMethod === "phone" ? "bg-emerald-600 text-white" : "bg-white text-gray-800"} transition-colors font-medium`} style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)', padding: 'clamp(6px, 1.8vw, 9px)', fontSize: 'clamp(11px, 3.2vw, 13px)' }}>
                <span>{t.login.phone}</span>
              </button>
              <button onClick={() => setLoginMethod("email")} className={`flex-1 flex items-center justify-center ${loginMethod === "email" ? "bg-emerald-600 text-white" : "bg-white text-gray-800"} transition-colors font-medium`} style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)', padding: 'clamp(6px, 1.8vw, 9px)', fontSize: 'clamp(11px, 3.2vw, 13px)' }}>
                <span>{t.login.email}</span>
              </button>
            </div>

            {loginMethod === "phone" && (
              <div className="bg-white overflow-hidden" style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)' }}>
                <div className="flex items-center" style={{ padding: 'clamp(7px, 2vw, 10px) clamp(10px, 2.5vw, 12px)' }}>
                  <Smartphone className="text-gray-400 flex-shrink-0" style={{ width: 'clamp(14px, 4vw, 18px)', height: 'clamp(14px, 4vw, 18px)', marginRight: 'clamp(6px, 2vw, 8px)' }} />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.login.phonePlaceholder} className="flex-1 outline-none min-w-0 bg-transparent text-gray-900 placeholder:text-gray-400" style={{ fontSize: 'clamp(11px, 3.2vw, 13px)' }} maxLength={11} />
                </div>
              </div>
            )}

            {loginMethod === "email" && (
              <div className="bg-white overflow-hidden" style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)' }}>
                <div className="flex items-center" style={{ padding: 'clamp(7px, 2vw, 10px) clamp(10px, 2.5vw, 12px)' }}>
                  <Mail className="text-gray-400 flex-shrink-0" style={{ width: 'clamp(14px, 4vw, 18px)', height: 'clamp(14px, 4vw, 18px)', marginRight: 'clamp(6px, 2vw, 8px)' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.login.emailPlaceholder} className="flex-1 outline-none min-w-0 bg-transparent text-gray-900 placeholder:text-gray-400" style={{ fontSize: 'clamp(11px, 3.2vw, 13px)' }} />
                </div>
              </div>
            )}

            <div className="flex" style={{ gap: 'clamp(5px, 1.5vw, 8px)' }}>
              <div className="flex-1 bg-white overflow-hidden min-w-0" style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)' }}>
                <div className="flex items-center" style={{ padding: 'clamp(7px, 2vw, 10px) clamp(10px, 2.5vw, 12px)' }}>
                  <MessageSquare className="text-gray-400 flex-shrink-0" style={{ width: 'clamp(14px, 4vw, 18px)', height: 'clamp(14px, 4vw, 18px)', marginRight: 'clamp(6px, 2vw, 8px)' }} />
                  <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.login.codePlaceholder} className="flex-1 outline-none min-w-0 bg-transparent text-gray-900 placeholder:text-gray-400" style={{ fontSize: 'clamp(11px, 3.2vw, 13px)' }} maxLength={6} />
                </div>
              </div>
              <button className="bg-emerald-600 text-white active:bg-emerald-700 transition-colors whitespace-nowrap font-medium flex-shrink-0" style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)', padding: 'clamp(7px, 2vw, 10px) clamp(10px, 2.8vw, 14px)', fontSize: 'clamp(10px, 2.8vw, 12px)' }}>
                {t.login.getCode}
              </button>
            </div>

            <button onClick={handleLogin} className="w-full bg-emerald-600 text-white active:bg-emerald-700 transition-colors font-medium" style={{ borderRadius: 'clamp(6px, 1.8vw, 10px)', padding: 'clamp(9px, 2.5vw, 12px)', fontSize: 'clamp(12px, 3.5vw, 14px)', marginTop: 'clamp(2px, 0.5vh, 4px)' }}>
              {t.login.oneClickLogin}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 默认导出用于懒加载
export default LoginPage;