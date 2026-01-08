import { Bot } from "lucide-react";

interface LoadingProps {
  message?: string;
}

export const Loading = ({ message = "Завантаження..." }: LoadingProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-50 overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/20 animate-float-particle"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + (i % 3)}s`
            }}
          />
        ))}
      </div>

      <div className="text-center p-8 relative z-10">
        {/* Glass cube with 3D effect */}
        <div className="relative w-32 h-32 mx-auto mb-6 perspective-1000">
          {/* Main glass cube */}
          <div 
            className="absolute inset-0 rounded-3xl backdrop-blur-xl border border-primary/30 shadow-2xl animate-cube-rotate"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 20px rgba(255,255,255,0.1)',
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Inner glow */}
            <div className="absolute inset-4 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20 animate-pulse" />
            
            {/* Bot icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Bot className="w-12 h-12 text-primary drop-shadow-lg animate-bounce" style={{ animationDuration: '2s' }} />
            </div>
            
            {/* Shine effect */}
            <div 
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-transparent to-transparent animate-shine"
              style={{ clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }}
            />
            
            {/* Floating particles inside cube */}
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-primary/60 animate-float-inside"
                style={{
                  left: `${20 + i * 20}%`,
                  top: `${30 + (i % 2) * 30}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '2.5s'
                }}
              />
            ))}
          </div>
          
          {/* Shadow under cube */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
        </div>

        <p className="text-muted-foreground text-lg animate-pulse">{message}</p>
        
        {/* Loading dots */}
        <div className="flex gap-2 justify-center mt-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes cube-rotate {
          0%, 100% { transform: rotateX(5deg) rotateY(-5deg); }
          25% { transform: rotateX(-5deg) rotateY(5deg); }
          50% { transform: rotateX(5deg) rotateY(10deg); }
          75% { transform: rotateX(-5deg) rotateY(-5deg); }
        }
        
        @keyframes shine {
          0%, 100% { opacity: 0.3; transform: translateX(-100%); }
          50% { opacity: 0.6; transform: translateX(100%); }
        }
        
        @keyframes float-particle {
          0%, 100% { transform: translateY(0px); opacity: 0.2; }
          50% { transform: translateY(-30px); opacity: 0.6; }
        }
        
        @keyframes float-inside {
          0%, 100% { transform: translate(0, 0); opacity: 0.4; }
          50% { transform: translate(10px, -10px); opacity: 0.8; }
        }
        
        .animate-cube-rotate {
          animation: cube-rotate 6s ease-in-out infinite;
        }
        
        .animate-shine {
          animation: shine 3s ease-in-out infinite;
        }
        
        .animate-float-particle {
          animation: float-particle 3s ease-in-out infinite;
        }
        
        .animate-float-inside {
          animation: float-inside 2.5s ease-in-out infinite;
        }
        
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};
