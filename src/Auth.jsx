import { useState } from "react";

const API_URL = "http://127.0.0.1:8001";

export default function Auth({ onLogin }) {
  const [loginType, setLoginType] = useState("user");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const endpoint = isRegister
        ? "/auth/register"
        : "/auth/login";

      const body = isRegister
        ? {
            name: name.trim(),
            identifier: identifier.trim(),
            password,
          }
        : {
            identifier: identifier.trim(),
            password,
          };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Something went wrong.");
      }

      if (isRegister) {
        setMessage("Registration successful! Please login.");
        setIsRegister(false);
        setName("");
        setPassword("");
        return;
      }

      const expectedRole =
        loginType === "admin" ? "admin" : "user";

      if (data.user?.role !== expectedRole) {
        throw new Error(
          loginType === "admin"
            ? "This account is not an Admin account."
            : "Please use Admin Login for this account."
        );
      }

      localStorage.setItem("ft_token", data.access_token);
      localStorage.setItem("ft_user", JSON.stringify(data.user));

      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Backend server is not running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ft-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

        .ft-page,
        .ft-page * {
          box-sizing: border-box;
        }

        .ft-page {
          min-height: 100vh;
          min-height: 100svh;
          width: 100%;
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 35px 20px 20px;
          color: white;
          font-family: 'Inter', 'Hind Siliguri', sans-serif;

          background:
            radial-gradient(ellipse at 10% 20%, #245dff 0%, transparent 38%),
            radial-gradient(ellipse at 90% 15%, #7436ed 0%, transparent 36%),
            radial-gradient(ellipse at 50% 100%, #087bdb 0%, transparent 48%),
            linear-gradient(135deg, #071447, #092d83 55%, #101052);
        }

        .ft-page::before,
        .ft-page::after {
          content: "";
          position: absolute;
          z-index: -1;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(110px);
          opacity: .25;
          pointer-events: none;
          animation: ftGlow 10s ease-in-out infinite alternate;
        }

        .ft-page::before {
          background: #00aaff;
          top: -300px;
          left: -180px;
        }

        .ft-page::after {
          background: #b12cff;
          bottom: -300px;
          right: -180px;
          animation-delay: 2s;
        }

        @keyframes ftGlow {
          from { transform: translate(0, 0); }
          to { transform: translate(45px, 35px); }
        }

        .ft-wave {
          position: absolute;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          pointer-events: none;
        }

        .ft-wave::before,
        .ft-wave::after {
          content: "";
          position: absolute;
          width: 850px;
          height: 330px;
          border: 1px solid #8acaff30;
          border-radius: 50%;
          transform: rotate(-22deg);
        }

        .ft-wave::before {
          top: -190px;
          left: -240px;
          box-shadow: 0 0 100px #167aff30;
        }

        .ft-wave::after {
          bottom: -240px;
          right: -230px;
          box-shadow: 0 0 100px #a35aff30;
        }

        .ft-content {
          width: 100%;
          max-width: 760px;
          position: relative;
          z-index: 2;
          margin: auto;
        }

        /* BRAND */

        .ft-brand {
          text-align: center;
          margin-bottom: 32px;
        }

        .ft-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 17px;
        }

        .ft-logo-icon {
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          border-radius: 23px;
          font-size: 43px;
          background: linear-gradient(135deg, #8a63ff, #075cff);
          border: 1px solid #ffffff85;
          box-shadow: 0 0 35px #488aff90;
        }

        .ft-logo h1 {
          margin: 0;
          font-size: clamp(35px, 6vw, 52px);
          font-weight: 800;
          letter-spacing: -2px;
        }

        .ft-logo h1 span {
          color: #00e6ed;
        }

        .ft-tagline {
          color: #d4e2ff;
          font-size: 17px;
          margin: 12px 0 0;
        }

        /* GLASS CARD */

        .ft-card {
          width: 100%;
          padding: 48px 55px;
          border-radius: 35px;

          background: linear-gradient(
            145deg,
            rgba(255,255,255,.30),
            rgba(255,255,255,.08) 55%,
            rgba(255,255,255,.18)
          );

          border: 1.5px solid rgba(255,255,255,.78);

          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);

          box-shadow:
            0 30px 90px rgba(0,0,0,.35),
            inset 0 1px 2px rgba(255,255,255,.65),
            0 0 45px rgba(80,160,255,.30);

          animation: ftAppear .7s ease;
        }

        @keyframes ftAppear {
          from {
            opacity: 0;
            transform: translateY(25px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* LOGIN TABS */

        .ft-tabs {
          display: flex;
          width: 100%;
          border: 1px solid #ffffff65;
          border-radius: 21px;
          padding: 4px;
          gap: 5px;
          margin-bottom: 30px;
          background: #071d5440;
        }

        .ft-tab {
          flex: 1;
          min-height: 65px;
          border: 0;
          border-radius: 17px;
          color: #e0eaff;
          background: transparent;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: .25s;
        }

        .ft-tab.active {
          background: linear-gradient(110deg, #00bfff, #075bff);
          color: white;
          box-shadow: 0 5px 25px #009dff90;
        }

        .ft-tab:hover:not(.active) {
          background: #ffffff20;
        }

        /* HEADINGS */

        .ft-heading {
          font-family: 'Hind Siliguri', sans-serif;
          font-size: clamp(24px, 4vw, 35px);
          font-weight: 700;
          line-height: 1.5;
          text-align: center;
          margin: 0 0 4px;
        }

        .ft-heading span {
          color: #00e6ed;
        }

        .ft-subheading {
          color: #d5e5ff;
          text-align: center;
          font-family: 'Hind Siliguri', sans-serif;
          font-size: 15px;
          line-height: 1.8;
          margin: 0 0 28px;
        }

        /* INPUTS */

        .ft-field {
          margin-bottom: 21px;
        }

        .ft-label {
          display: block;
          margin-bottom: 9px;
          font-size: 15px;
          font-weight: 700;
          color: #f5f8ff;
        }

        .ft-input-wrap {
          display: flex;
          align-items: center;
          border: 1px solid #ffffff80;
          border-radius: 15px;
          background: #ffffff15;
          transition: .25s;
          overflow: hidden;
        }

        .ft-input-wrap:focus-within {
          border-color: #00e5ff;
          box-shadow: 0 0 0 3px #00cfff30;
          background: #ffffff25;
        }

        .ft-input-icon {
          padding-left: 16px;
          color: #d2e2ff;
          font-size: 20px;
          flex-shrink: 0;
        }

        .ft-input {
          width: 100%;
          min-width: 0;
          height: 59px;
          padding: 0 14px;
          border: none;
          outline: none;
          background: transparent;
          color: white;
          font-size: 14px;
          font-family: inherit;
        }

        .ft-input::placeholder {
          color: #d4e0f5c0;
        }

        .ft-eye {
          padding: 10px 15px;
          border: 0;
          color: #d5e5ff;
          background: transparent;
          cursor: pointer;
          font-size: 19px;
        }
                  /* REMEMBER ME */

        .ft-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 5px 0 27px;
          font-size: 14px;
          color: #e0eaff;
        }

        .ft-remember {
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
        }

        .ft-remember input {
          width: 19px;
          height: 19px;
          accent-color: #00cfff;
          cursor: pointer;
        }

        /* LOGIN BUTTON */

        .ft-submit {
          width: 100%;
          min-height: 66px;
          border: 0;
          border-radius: 19px;
          background: linear-gradient(
            105deg,
            #00e5e7,
            #087aff 65%,
            #713dff
          );
          color: white;
          font-size: 19px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 8px 28px #008dff65;
          transition: .25s;
        }

        .ft-submit:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 13px 35px #008dff90;
          filter: brightness(1.1);
        }

        .ft-submit:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        /* REGISTER */

        .ft-register {
          margin: 27px 0 0;
          text-align: center;
          color: #e1ebff;
          font-size: 15px;
        }

        .ft-link {
          border: 0;
          background: none;
          color: #00e8f2;
          font-size: inherit;
          font-weight: 800;
          cursor: pointer;
          padding: 3px;
        }

        .ft-link:hover {
          text-decoration: underline;
        }

        /* ALERTS */

        .ft-alert {
          padding: 12px 14px;
          border-radius: 12px;
          margin-bottom: 17px;
          font-size: 13px;
          line-height: 1.5;
        }

        .ft-error {
          background: #ff30452b;
          border: 1px solid #ff8390;
          color: #ffd7db;
        }

        .ft-success {
          background: #00d58c25;
          border: 1px solid #54e8b0;
          color: #b6ffe0;
        }

        .ft-admin-note {
          text-align: center;
          margin: 22px 0 0;
          font-size: 12px;
          color: #c4d4f1;
        }

        /* STUDY DESK DECORATION */

        .ft-decor {
          position: absolute;
          z-index: 1;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(0 8px 15px #0005);
        }

        .ft-decor-left {
          left: 3%;
          bottom: 12%;
          font-size: clamp(55px, 8vw, 105px);
          animation: ftFloat 5s ease-in-out infinite;
        }

        .ft-decor-right {
          right: 3%;
          bottom: 12%;
          font-size: clamp(55px, 8vw, 105px);
          animation: ftFloat 6s ease-in-out infinite reverse;
        }

        .ft-sticky {
          position: absolute;
          right: 7%;
          top: 38%;
          z-index: 1;
          padding: 17px 19px;
          background: #fff4c7;
          color: #233a70;
          font-size: 13px;
          line-height: 2;
          transform: rotate(-9deg);
          box-shadow: 0 8px 20px #0004;
          pointer-events: none;
        }

        @keyframes ftFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-13px);
          }
        }

        /* FOOTER */

        .ft-footer {
          width: 100%;
          text-align: center;
          padding: 27px 10px 5px;
          color: #d5e2ff;
          font-size: 13px;
          line-height: 1.9;
          position: relative;
          z-index: 2;
        }

        .ft-footer p {
          margin: 3px 0;
        }

        .ft-footer strong {
          color: #00e6ed;
        }

        /* RESPONSIVE */

        @media (max-width: 900px) {
          .ft-decor-left,
          .ft-decor-right,
          .ft-sticky {
            display: none;
          }

          .ft-content {
            max-width: 620px;
          }
        }

        @media (max-width: 600px) {
          .ft-page {
            padding: 25px 15px 14px;
            justify-content: flex-start;
          }

          .ft-content {
            margin: auto;
          }

          .ft-brand {
            margin-bottom: 24px;
          }

          .ft-logo {
            gap: 11px;
          }

          .ft-logo-icon {
            width: 55px;
            height: 55px;
            font-size: 30px;
            border-radius: 16px;
          }

          .ft-logo h1 {
            font-size: 34px;
          }

          .ft-tagline {
            font-size: 13px;
            margin-top: 8px;
          }

          .ft-card {
            padding: 25px 19px;
            border-radius: 25px;
          }

          .ft-tabs {
            margin-bottom: 24px;
          }

          .ft-tab {
            min-height: 53px;
            font-size: 13px;
          }

          .ft-heading {
            font-size: 24px;
          }

          .ft-subheading {
            font-size: 13px;
            margin-bottom: 23px;
          }

          .ft-input {
            height: 53px;
            font-size: 13px;
          }

          .ft-options {
            font-size: 12px;
          }

          .ft-submit {
            min-height: 56px;
            font-size: 16px;
          }

          .ft-footer {
            padding-top: 24px;
            font-size: 11px;
          }
        }

        @media (max-width: 360px) {
          .ft-card {
            padding: 21px 15px;
          }

          .ft-tab {
            font-size: 12px;
          }

          .ft-heading {
            font-size: 21px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ft-page *,
          .ft-page *::before,
          .ft-page *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="ft-wave" />

      <div className="ft-decor ft-decor-left">
        📚 🪴 💡
      </div>

      <div className="ft-decor ft-decor-right">
        💻 ✏️
      </div>

      <div className="ft-sticky">
        ✓ Study<br />
        ✓ Focus<br />
        ✓ Tracking<br />
        ✓ Achieve
      </div>

      <main className="ft-content">

        <header className="ft-brand">
          <div className="ft-logo">
            <div className="ft-logo-icon">⏱</div>

            <h1>
              Focus<span>Track</span>
            </h1>
          </div>

          <p className="ft-tagline">
            Study Smarter. Stay Focused.
          </p>
        </header>

        <section className="ft-card">

          {!isRegister && (
            <div className="ft-tabs">
              <button
                type="button"
                className={`ft-tab ${loginType === "user" ? "active" : ""}`}
                onClick={() => {
                  setLoginType("user");
                  resetMessages();
                }}
              >
                🎓 Student Login
              </button>

              <button
                type="button"
                className={`ft-tab ${loginType === "admin" ? "active" : ""}`}
                onClick={() => {
                  setLoginType("admin");
                  resetMessages();
                }}
              >
                🛡 Admin Login
              </button>
            </div>
          )}

          <h2 className="ft-heading">
            {isRegister
              ? "নতুন অ্যাকাউন্ট তৈরি করো"
              : loginType === "admin"
                ? "Admin Login"
                : <>আগামী দিন, আরও <span>ফোকাসড থাকবো!</span></>}
          </h2>

          <p className="ft-subheading">
            {isRegister
              ? "তোমার ব্যক্তিগত FocusTrack অ্যাকাউন্ট তৈরি করো।"
              : loginType === "admin"
                ? "Login to manage FocusTrack users."
                : "পড়াশোনা পরিকল্পনা করো, সময়কে কাজে লাগাও, নিজের অগ্রগতি দেখো।"}
          </p>

          {error && (
            <div className="ft-alert ft-error">
              {error}
            </div>
          )}

          {message && (
            <div className="ft-alert ft-success">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {isRegister && (
              <div className="ft-field">
                <label className="ft-label">
                  👤 Full Name
                </label>

                <div className="ft-input-wrap">
                  <span className="ft-input-icon">👤</span>

                  <input
                    className="ft-input"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>
              </div>
            )}

            <div className="ft-field">
              <label className="ft-label">
                ✉️ Email or Phone Number
              </label>

              <div className="ft-input-wrap">
                <span className="ft-input-icon">👤</span>

                <input
                  className="ft-input"
                  type="text"
                  placeholder="example@gmail.com or 01XXXXXXXXX"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  minLength={5}
                  maxLength={150}
                  required
                />
              </div>
            </div>

            <div className="ft-field">
              <label className="ft-label">
                🔒 Password
              </label>

              <div className="ft-input-wrap">
                <span className="ft-input-icon">🔐</span>

                <input
                  className="ft-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password (minimum 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />

                <button
                  type="button"
                  className="ft-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {!isRegister && loginType === "user" && (
              <div className="ft-options">
                <label className="ft-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
              </div>
            )}

            <button
              className="ft-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create Account →"
                  : loginType === "admin"
                    ? "🛡 Login as Admin"
                    : "↪ Log In"}
            </button>
          </form>

          {loginType === "user" && (
            <p className="ft-register">
              {isRegister
                ? "Already have an account? "
                : "Don't have an account? "}

              <button
                type="button"
                className="ft-link"
                onClick={() => {
                  setIsRegister(!isRegister);
                  resetMessages();
                  setName("");
                  setPassword("");
                  setShowPassword(false);
                }}
              >
                {isRegister ? "Login" : "Register"}
              </button>
            </p>
          )}

          {loginType === "admin" && (
            <p className="ft-admin-note">
              Authorized administrators only.
            </p>
          )}
        </section>
      </main>

      <footer className="ft-footer">
        <p>© 2026 FocusTrack. All Rights Reserved.</p>

        <p>
          Designed & Developed by{" "}
          <strong>Akash Hasan</strong> ❤️
        </p>
      </footer>
    </div>
  );
}