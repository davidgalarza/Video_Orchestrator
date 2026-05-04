import { useEffect, useRef } from 'react';
import type { Scene } from '../api';
import { MessageBubble } from './MessageBubble';

interface ChatFeedProps {
  projectId: string;
  scenes: Scene[];
  onRefresh: () => void;
}

export function ChatFeed({ projectId, scenes, onRefresh }: ChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new scenes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scenes.length]);

  return (
    <div 
      ref={scrollRef}
      className="flex-grow overflow-y-auto scroll-smooth flex flex-col pt-10 pb-20 custom-scrollbar"
    >
      {scenes.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-zinc-800 rotate-12">
             <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center -rotate-12">
               <span className="text-black font-black text-2xl italic">V</span>
             </div>
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">Start your story</h2>
          <p className="text-zinc-500 text-sm max-w-sm">
            Add your first scene below. Flow Intelligence will maintain style consistency based on your asset tray.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {scenes
            .sort((a, b) => a.order - b.order)
            .map((scene) => (
              <MessageBubble 
                key={scene.id} 
                scene={scene} 
                projectId={projectId} 
                onRefresh={onRefresh} 
              />
            ))}
        </div>
      )}
    </div>
  );
}
