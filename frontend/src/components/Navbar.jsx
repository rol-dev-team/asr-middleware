// import { useState, useEffect } from "react";
// import { Mic, BarChart3, User, LogOut, Sun, Moon } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import logo from "@/assets/kothalipi_logo.png";

// const Navbar = ({ onLogout, user }) => {
//   const [isDark, setIsDark] = useState(() => {
//     if (typeof window !== "undefined") {
//       return localStorage.getItem("theme") === "dark" ||
//         (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
//     }
//     return true;
//   });

//   useEffect(() => {
//     document.documentElement.classList.toggle("dark", isDark);
//     localStorage.setItem("theme", isDark ? "dark" : "light");
//   }, [isDark]);

//   return (
//     <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 glass">
//       <div className="container mx-auto flex h-16 items-center justify-between px-6">
//         <div className="flex items-center gap-3">
//           <img src={logo} alt="Kothalipi" className="h-14 w-auto" />
//         </div>
//         <div className="flex items-center gap-1 rounded-xl bg-secondary/50 p-1">
//           <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all">
//             <Mic className="h-3.5 w-3.5" />Meetings
//           </button>
//           <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
//             <BarChart3 className="h-3.5 w-3.5" />Analyses
//           </button>
//         </div>
//         <div className="flex items-center gap-2">
//           <button onClick={() => setIsDark(!isDark)} className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground" aria-label="Toggle theme">
//             <AnimatePresence mode="wait">
//               <motion.div key={isDark ? "sun" : "moon"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
//                 {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
//               </motion.div>
//             </AnimatePresence>
//           </button>
//           <div className="h-5 w-px bg-border" />
//           <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5">
//             <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
//               <User className="h-3 w-3 text-primary" />
//             </div>
//             <span className="font-mono text-[11px] text-muted-foreground">{user?.username || "user"}</span>
//           </div>
//           <button onClick={onLogout} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
//             <LogOut className="h-3.5 w-3.5" />
//           </button>
//         </div>
//       </div>
//     </motion.nav>
//   );
// };

// export default Navbar;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, BookOpen, User, LogOut, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/kothalipi_logo.png";

const Navbar = ({ onLogout, user, activePage = "meetings" }) => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Kothalipi" className="h-14 w-auto" />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${activePage === "meetings" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Mic className="h-3.5 w-3.5" />Meetings
          </button>
          <button
            onClick={() => navigate("/insights")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${activePage === "insights" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <BookOpen className="h-3.5 w-3.5" />Meeting Insights
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDark(!isDark)} className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground" aria-label="Toggle theme">
            <AnimatePresence mode="wait">
              <motion.div key={isDark ? "sun" : "moon"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.div>
            </AnimatePresence>
          </button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <User className="h-3 w-3 text-primary" />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{user?.username || "user"}</span>
          </div>
          <button onClick={onLogout} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
