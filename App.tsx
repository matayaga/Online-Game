
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Droplets, TreePine, BrickWall, ThermometerSun, Trophy, Users, Bot, 
  MapPin, Shield, HeartCrack, ShoppingCart, Zap, ArrowRightLeft, 
  Leaf, Warehouse, MessageSquare, RefreshCcw, Send, Loader2
} from 'lucide-react';
import { 
  GameState, Player, Card, GameLog, InteractionMode, ResourceType, ResourceSet 
} from './types';
import { 
  MAX_SCORE, ZONES, RAW_CARDS, CLIMATE_EVENTS, EVENT_INTERVAL_ROUNDS 
} from './constants';
import { getClimateMasterCommentary, getAiMoveDecision } from './services/geminiService';

const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  const [view, setView] = useState<'lobby' | 'playing' | 'result'>('lobby');
  const [playerName, setPlayerName] = useState('玩家');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [aiCommentary, setAiCommentary] = useState<string>('歡迎來到熱島求生！準備好面對極端氣候了嗎？');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiMoving, setIsAiMoving] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode | null>(null);

  // Local state for UI forms
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');
  const [targetResource, setTargetResource] = useState<ResourceType>('water');

  // Initialize Game
  const initGame = (withAi: boolean) => {
    const p1: Player = {
      id: 'human',
      name: playerName || '玩家',
      isAi: false,
      color: 'bg-blue-500',
      zone: 'buffer',
      resources: { ...ZONES.BUFFER.initial },
      score: 0,
      buildings: []
    };

    const players = [p1];
    if (withAi) {
      players.push({
        id: 'ai-1',
        name: 'AI 導航員',
        isAi: true,
        color: 'bg-purple-600',
        zone: 'lowlying',
        resources: { ...ZONES.LOWLYING.initial },
        score: 0,
        buildings: []
      });
    }

    const deck: Card[] = [];
    RAW_CARDS.forEach(c => {
      for (let i = 0; i < 4; i++) {
        deck.push({ ...c, uuid: generateId(), maxHp: c.hp } as Card);
      }
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const market = deck.splice(0, 4);

    const newState: GameState = {
      status: 'playing',
      roomId: generateId().toUpperCase(),
      players,
      turnIndex: 0,
      turnPhase: 2,
      roundCount: 1,
      turnTotal: 0,
      winner: null,
      globalTemp: 30,
      market,
      deck,
      logs: [{ msg: "遊戲開始！努力建設並調適氣候風險。", time: Date.now(), type: 'system' }]
    };

    setGameState(newState);
    setView('playing');
  };

  // Logic: AI Turn
  useEffect(() => {
    if (gameState?.status === 'playing' && gameState.players[gameState.turnIndex].isAi) {
      const timer = setTimeout(() => handleAiMove(), 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState?.turnIndex, gameState?.status, gameState?.turnPhase]);

  // Logic: AI Commentary update
  useEffect(() => {
    if (gameState?.status === 'playing' && gameState.turnPhase === 2) {
      updateAiCommentary();
    }
  }, [gameState?.turnIndex, gameState?.roundCount]);

  const updateAiCommentary = async () => {
    if (!gameState) return;
    setIsAiThinking(true);
    const msg = await getClimateMasterCommentary(gameState);
    setAiCommentary(msg);
    setIsAiThinking(false);
  };

  const addLog = (msg: string, type: GameLog['type'] = 'action') => {
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        logs: [...prev.logs, { msg, time: Date.now(), type }]
      };
    });
  };

  const handleAiMove = async () => {
    if (!gameState) return;
    setIsAiMoving(true);
    const aiPlayer = gameState.players[gameState.turnIndex];
    
    // Strategic Decision from Gemini
    const decision = await getAiMoveDecision(gameState);
    
    if (gameState.turnPhase === 2) {
      if (decision.action === 'plunder' && decision.targetId) {
        const targetIdx = gameState.players.findIndex(p => p.id === decision.targetId);
        const res = decision.resource || 'water';
        if (targetIdx !== -1 && gameState.players[targetIdx].resources[res] > 0) {
          const nextPlayers = [...gameState.players];
          nextPlayers[targetIdx].resources[res]--;
          nextPlayers[gameState.turnIndex].resources[res]++;
          addLog(`🤖 ${aiPlayer.name} 執行掠奪：從 ${nextPlayers[targetIdx].name} 奪取了 ${res}。 (${decision.reasoning})`, 'ai');
          setGameState(prev => prev ? ({ ...prev, players: nextPlayers, turnPhase: 3 }) : null);
        } else {
          addLog(`🤖 ${aiPlayer.name} 試圖掠奪，但目標資源不足。`, 'ai');
          setGameState(prev => prev ? ({ ...prev, turnPhase: 3 }) : null);
        }
      } else if (decision.action === 'bank_trade' && aiPlayer.resources.water >= 3) {
        const nextPlayers = [...gameState.players];
        nextPlayers[gameState.turnIndex].resources.water -= 3;
        nextPlayers[gameState.turnIndex].resources.material += 1;
        addLog(`🤖 ${aiPlayer.name} 向銀行兌換建材。 (${decision.reasoning})`, 'ai');
        setGameState(prev => prev ? ({ ...prev, players: nextPlayers, turnPhase: 3 }) : null);
      } else {
        addLog(`🤖 ${aiPlayer.name} 跳過互動階段。 (${decision.reasoning})`, 'ai');
        setGameState(prev => prev ? ({ ...prev, turnPhase: 3 }) : null);
      }
    } else {
      // Building Phase
      if (decision.action === 'build' && decision.cardUuid) {
        const cardIdx = gameState.market.findIndex(c => c.uuid === decision.cardUuid);
        if (cardIdx !== -1) {
          const card = gameState.market[cardIdx];
          const affordable = Object.entries(card.cost).every(([res, val]) => aiPlayer.resources[res as ResourceType] >= (val || 0));
          if (affordable) {
            addLog(`🤖 ${aiPlayer.name} 戰略建設：${card.name}。 (${decision.reasoning})`, 'ai');
            executeBuild(card, cardIdx);
          } else {
            addLog(`🤖 ${aiPlayer.name} 想要建設 ${card.name} 但資源不足，結束回合。`, 'ai');
            finishTurn(gameState.players, gameState.market, gameState.deck, false);
          }
        } else {
          finishTurn(gameState.players, gameState.market, gameState.deck, false);
        }
      } else {
        addLog(`🤖 ${aiPlayer.name} 觀察後決定結束回合。 (${decision.reasoning})`, 'ai');
        finishTurn(gameState.players, gameState.market, gameState.deck, false);
      }
    }
    setIsAiMoving(false);
  };

  const finishTurn = (players: Player[], market: Card[], deck: Card[], heatUp: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      
      let nextPlayers = [...players];
      let nextMarket = [...market];
      let nextDeck = [...deck];
      let nextGlobalTemp = prev.globalTemp + (heatUp ? 2 : 0);
      let nextTurnTotal = prev.turnTotal + 1;
      let nextTurnIndex = (prev.turnIndex + 1) % nextPlayers.length;
      let nextRoundCount = prev.roundCount;
      let nextLogs = [...prev.logs];
      let nextStatus = prev.status;
      let winner = prev.winner;

      // Check win condition
      if (nextPlayers[prev.turnIndex].score >= MAX_SCORE) {
        winner = nextPlayers[prev.turnIndex].id;
        nextStatus = 'finished';
        nextLogs.push({ msg: `🏆 ${nextPlayers[prev.turnIndex].name} 積分達標，獲勝！`, time: Date.now(), type: 'system' });
        setView('result');
      }

      // Round End Logic
      if (nextTurnTotal > 0 && nextTurnTotal % nextPlayers.length === 0) {
        nextRoundCount++;
        nextLogs.push({ msg: `--- 第 ${prev.roundCount} 輪結束 ---`, time: Date.now(), type: 'system' });

        // 1. Production
        nextPlayers = nextPlayers.map(p => {
          const prod = ZONES[p.zone.toUpperCase()].production;
          const newRes = { ...p.resources };
          (Object.keys(prod) as ResourceType[]).forEach(k => {
            newRes[k] = (newRes[k] || 0) + (prod[k] || 0);
          });
          return { ...p, resources: newRes };
        });
        nextLogs.push({ msg: `💰 季節交替：各區資源產出。`, time: Date.now(), type: 'system' });

        // 2. Climate Event
        if (prev.roundCount % EVENT_INTERVAL_ROUNDS === 0) {
          const event = CLIMATE_EVENTS[Math.floor(Math.random() * CLIMATE_EVENTS.length)];
          nextLogs.push({ msg: `⚠️【氣候事件】${event.name} (強度${event.intensity})`, time: Date.now(), type: 'event' });
          
          nextPlayers = nextPlayers.map(p => {
            if (!event.targets.includes(p.zone)) return p;
            const resilience = p.buildings.reduce((sum, b) => sum + b.resilience, 0);
            if (resilience < event.intensity) {
              let damage = event.intensity - resilience;
              const newBuildings = p.buildings.map(b => ({ ...b }));
              newBuildings.sort((a,b) => a.hp - b.hp);
              const destroyed: string[] = [];
              for (let b of newBuildings) {
                if (damage <= 0) break;
                const hit = Math.min(damage, b.hp);
                b.hp -= hit;
                damage -= hit;
                if (b.hp <= 0) destroyed.push(b.name);
              }
              const survivors = newBuildings.filter(b => b.hp > 0);
              if (destroyed.length > 0) {
                nextLogs.push({ msg: `💔 ${p.name} 的 ${destroyed.join(',')} 倒塌！`, time: Date.now(), type: 'event' });
              }
              return { ...p, buildings: survivors, score: survivors.reduce((s, b) => s + b.score, 0) };
            }
            nextLogs.push({ msg: `✅ ${p.name} 成功抵禦了 ${event.name}。`, time: Date.now(), type: 'event' });
            return p;
          });
        }
      }

      return {
        ...prev,
        players: nextPlayers,
        market: nextMarket,
        deck: nextDeck,
        globalTemp: nextGlobalTemp,
        turnTotal: nextTurnTotal,
        turnIndex: nextTurnIndex,
        roundCount: nextRoundCount,
        turnPhase: 2,
        logs: nextLogs,
        status: nextStatus,
        winner
      };
    });
  };

  const executeBuild = (card: Card, marketIndex: number) => {
    if (!gameState) return;
    const currIdx = gameState.turnIndex;
    const p = gameState.players[currIdx];

    const nextPlayers = [...gameState.players];
    const updatedPlayer = { ...p };
    (Object.entries(card.cost) as [ResourceType, number][]).forEach(([res, val]) => {
      updatedPlayer.resources[res] -= val;
    });
    updatedPlayer.buildings = [...updatedPlayer.buildings, { ...card, uuid: generateId() }];
    updatedPlayer.score = updatedPlayer.buildings.reduce((sum, b) => sum + b.score, 0);
    nextPlayers[currIdx] = updatedPlayer;

    const nextMarket = [...gameState.market];
    const nextDeck = [...gameState.deck];
    nextMarket.splice(marketIndex, 1);
    if (nextDeck.length > 0) {
      nextMarket.push(nextDeck.shift()!);
    }

    if (!p.isAi) addLog(`${p.name} 建造了「${card.name}」。`);
    finishTurn(nextPlayers, nextMarket, nextDeck, card.effect === 'heat_up');
  };

  const handleInteraction = (mode: InteractionMode) => {
    if (!gameState) return;
    const p = gameState.players[gameState.turnIndex];
    let nextPlayers = [...gameState.players];
    let msg = "";

    if (mode === InteractionMode.BANK_TRADE) {
      if (p.resources.water < 3) return alert("水資源不足(需3換1)");
      nextPlayers[gameState.turnIndex].resources.water -= 3;
      nextPlayers[gameState.turnIndex].resources.material += 1;
      msg = `${p.name} 向銀行兌換了建材。`;
    } else if (mode === InteractionMode.PLUNDER) {
      if (!targetPlayerId) return alert("請選擇目標");
      const targetIdx = nextPlayers.findIndex(pl => pl.id === targetPlayerId);
      const targetPl = nextPlayers[targetIdx];
      if (targetPl.resources[targetResource] > 0) {
        nextPlayers[targetIdx].resources[targetResource]--;
        nextPlayers[gameState.turnIndex].resources[targetResource]++;
        msg = `${p.name} 從 ${targetPl.name} 那裡掠奪了 ${targetResource === 'water' ? '水' : targetResource === 'green' ? '綠化' : '建材'}！`;
      } else {
        msg = `${p.name} 試圖掠奪，但 ${targetPl.name} 資源不足。`;
      }
    }

    setGameState(prev => prev ? ({ ...prev, players: nextPlayers, turnPhase: 3 }) : null);
    if (msg) addLog(msg);
    setInteractionMode(null);
  };

  // Helper: Resource Track Component
  const ResourceBar = ({ type, value, max = 15 }: { type: ResourceType, value: number, max?: number }) => {
    const colors = {
      water: 'bg-blue-500',
      green: 'bg-emerald-500',
      material: 'bg-amber-600'
    };
    const icons = {
      water: <Droplets size={12}/>,
      green: <TreePine size={12}/>,
      material: <BrickWall size={12}/>
    };
    return (
      <div className="flex items-center gap-2 w-full">
        <div className={`p-1 rounded ${colors[type]} text-white`}>{icons[type]}</div>
        <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden relative">
           <div 
             className={`${colors[type]} h-full transition-all duration-500`} 
             style={{ width: `${Math.min(100, (value / max) * 100)}%` }} 
           />
        </div>
        <span className="text-xs font-bold w-4">{value}</span>
      </div>
    );
  };

  if (view === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-100">
        <div className="max-w-md w-full glass-card p-10 rounded-3xl shadow-2xl space-y-8 border-t-4 border-orange-500">
          <div className="text-center">
             <div className="inline-block p-4 bg-orange-100 rounded-2xl mb-4">
                <ThermometerSun className="w-12 h-12 text-orange-600" />
             </div>
             <h1 className="text-4xl font-extrabold text-gray-900">熱島求生 <span className="text-orange-600">5.0</span></h1>
             <p className="mt-2 text-gray-500 font-medium">在極端氣候中打造最具韌性的未來城市</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">您的暱稱</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
              />
            </div>
            <button 
              onClick={() => initGame(true)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 group"
            >
              <Zap size={20} className="group-hover:animate-pulse"/> 與 AI 導航員對局
            </button>
            <button 
              onClick={() => initGame(false)}
              className="w-full bg-stone-800 hover:bg-stone-900 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Users size={20}/> 本地多人對戰
            </button>
          </div>
          <div className="text-center text-xs text-gray-400">
            具備 Gemini 支援的氣候導師與戰略 AI
          </div>
        </div>
      </div>
    );
  }

  if (view === 'result' && gameState) {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-lg w-full">
            <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={48} />
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-2">城市霸主誕生</h2>
            <p className="text-xl text-gray-600 mb-8">恭喜 <span className="font-bold text-orange-600">{winner?.name}</span> 成功打造了最具韌性的未來城市！</p>
            <div className="bg-stone-100 rounded-2xl p-6 mb-8 text-left space-y-2">
               <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest">最終成就</h4>
               <p className="flex justify-between"><span>建設積分</span> <span className="font-bold text-orange-600">{winner?.score}</span></p>
               <p className="flex justify-between"><span>氣候韌性</span> <span className="font-bold text-blue-600">{winner?.buildings.reduce((s,b)=>s+b.resilience, 0)}</span></p>
            </div>
            <button 
              onClick={() => setView('lobby')}
              className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-orange-700 shadow-xl transition-all"
            >
              重新開始
            </button>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.turnIndex];
  const isMyTurn = !currentPlayer.isAi;
  const tempSeverity = Math.min(100, Math.max(0, (gameState.globalTemp - 30) * 10));

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-2 rounded-xl text-white">
            <ThermometerSun size={24}/>
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight">URBAN HEAT <span className="text-orange-500">5.0</span></h1>
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
               <span className="flex items-center gap-1"><RefreshCcw size={12}/> 第 {gameState.roundCount} 輪</span>
               <span className="flex items-center gap-1 text-red-500 animate-pulse"><Zap size={12}/> 災害倒數: {EVENT_INTERVAL_ROUNDS - ((gameState.roundCount-1)%EVENT_INTERVAL_ROUNDS)} 輪</span>
               <div className="flex items-center gap-2 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(${150 + tempSeverity}, ${150 - tempSeverity}, 100)` }}></span>
                 <span className="text-stone-600">當前氣溫: {gameState.globalTemp}°C</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {gameState.players.map(p => (
             <div key={p.id} className={`flex items-center gap-2 p-1.5 pr-4 rounded-full border transition-all ${p.id === currentPlayer.id ? 'border-orange-500 ring-2 ring-orange-50 shadow-sm bg-white' : 'border-gray-100 opacity-60'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-inner ${p.color}`}>
                   {p.isAi ? <Bot size={16}/> : <Users size={16}/>}
                </div>
                <div className="text-xs">
                   <p className="font-bold leading-none">{p.name}</p>
                   <p className="text-[10px] text-gray-400 font-black">積分: {p.score}</p>
                </div>
             </div>
           ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar: AI Consultant */}
        <aside className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
           <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-stone-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider"><MessageSquare size={18} className="text-blue-500"/> 氣候導師建議</h3>
              {isAiThinking && <Loader2 size={16} className="text-orange-500 animate-spin"/>}
           </div>
           <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className={`bg-blue-50 p-4 rounded-2xl border border-blue-100 relative transition-opacity duration-300 ${isAiThinking ? 'opacity-50' : 'opacity-100'}`}>
                 <div className="absolute -left-1 top-4 w-2 h-2 bg-blue-50 border-l border-b border-blue-100 rotate-45"></div>
                 <p className="text-sm text-blue-900 leading-relaxed font-medium italic">
                   "{aiCommentary}"
                 </p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">戰報日誌</h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                   {gameState.logs.slice().reverse().map((log, i) => (
                     <div key={i} className={`text-[11px] p-2.5 rounded-xl border ${
                       log.type === 'event' ? 'bg-red-50 text-red-700 border-red-100' : 
                       log.type === 'ai' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                       'bg-stone-50 text-stone-600 border-stone-100'
                     }`}>
                        <span className="opacity-50 font-mono mr-1">[{new Date(log.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                        {log.msg}
                     </div>
                   ))}
                </div>
              </div>
           </div>
        </aside>

        {/* Central Grid: Players View */}
        <section className="flex-1 overflow-y-auto p-6 space-y-6">
           {/* Market */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-lg font-black flex items-center gap-2"><ShoppingCart className="text-orange-500"/> 建設市場</h2>
                 <div className="bg-stone-100 px-3 py-1 rounded-full text-[10px] text-stone-400 font-black tracking-widest uppercase">牌庫餘額: {gameState.deck.length}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {gameState.market.map((card, idx) => {
                    const affordable = Object.entries(card.cost).every(([res, val]) => (currentPlayer.resources[res as ResourceType] || 0) >= (val || 0));
                    const canBuild = isMyTurn && gameState.turnPhase === 3 && affordable;
                    
                    return (
                      <div 
                        key={card.uuid} 
                        className={`group p-5 rounded-3xl border transition-all duration-300 relative h-60 flex flex-col justify-between
                          ${canBuild ? 'bg-white border-orange-200 shadow-md hover:-translate-y-1 hover:border-orange-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-60 cursor-default'}
                        `}
                        onClick={() => canBuild && executeBuild(card, idx)}
                      >
                         <div>
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex flex-col">
                                  <h4 className="font-bold text-sm leading-tight text-gray-800 group-hover:text-orange-600 transition-colors">{card.name}</h4>
                                  <span className={`text-[9px] px-1.5 py-0.5 mt-1 rounded-md w-fit font-black uppercase tracking-tighter ${card.type === 'build' ? 'bg-stone-200 text-stone-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                     {card.type === 'build' ? '居住設施' : '環境調適'}
                                  </span>
                               </div>
                               <div className="text-orange-600 text-sm font-black bg-orange-50 px-2 py-0.5 rounded-full">+{card.score}</div>
                            </div>
                            <p className="text-[10px] text-gray-500 line-clamp-3 leading-relaxed mb-3">{card.desc}</p>
                         </div>

                         <div className="space-y-3">
                            <div className="flex gap-2">
                               <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"><Shield size={10}/> {card.resilience} 韌性</span>
                               <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100"><HeartCrack size={10}/> {card.hp} 耐久</span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                               {(Object.entries(card.cost) as [ResourceType, number][]).map(([res, val]) => (
                                 <div key={res} className={`flex items-center gap-1 text-[10px] font-black ${currentPlayer.resources[res] >= val ? 'text-gray-700' : 'text-red-500 underline decoration-dotted'}`}>
                                    {res === 'water' ? <Droplets size={10} className="text-blue-500"/> : res === 'green' ? <TreePine size={10} className="text-emerald-500"/> : <BrickWall size={10} className="text-amber-700"/>}
                                    {val}
                                 </div>
                               ))}
                            </div>
                         </div>

                         {canBuild && (
                           <div className="absolute inset-0 bg-orange-600 bg-opacity-0 group-hover:bg-opacity-5 transition-all rounded-3xl flex items-center justify-center pointer-events-none">
                              <span className="hidden group-hover:block bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl animate-bounce">點擊建造</span>
                           </div>
                         )}
                      </div>
                    );
                 })}
              </div>
           </div>

           {/* Player Boards */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
              {gameState.players.map(p => {
                const zone = ZONES[p.zone.toUpperCase()];
                return (
                  <div key={p.id} className={`bg-white rounded-3xl p-6 border-2 transition-all ${p.id === currentPlayer.id ? 'border-orange-400 shadow-xl' : 'border-transparent shadow-sm opacity-90'}`}>
                    <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-3">
                          <div className={`w-14 h-14 rounded-2xl ${p.color} flex items-center justify-center text-white shadow-xl ring-4 ring-offset-2 ring-transparent ${p.id === currentPlayer.id ? 'ring-orange-100 scale-105' : ''}`}>
                             {p.isAi ? <Bot size={28}/> : <Users size={28}/>}
                          </div>
                          <div>
                             <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                               {p.name} 
                               {p.id === currentPlayer.id && <span className="bg-orange-500 text-[10px] text-white px-2 py-0.5 rounded-full font-black animate-pulse">行動中</span>}
                             </h3>
                             <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${zone.color} border-current`}>
                               <MapPin size={10}/> {zone.name} • {zone.desc}
                             </span>
                          </div>
                       </div>
                       <div className="text-right">
                          <div className="text-3xl font-black text-orange-600 leading-none">{p.score}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">成就積分</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mb-6 bg-stone-50 p-5 rounded-3xl border border-stone-100">
                       <ResourceBar type="water" value={p.resources.water} />
                       <ResourceBar type="green" value={p.resources.green} />
                       <ResourceBar type="material" value={p.resources.material} />
                    </div>

                    <div className="space-y-2 h-40 overflow-y-auto pr-2 scrollbar-thin">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex justify-between">
                         <span>已建施設施</span>
                         <span>韌性總和: {p.buildings.reduce((s,b)=>s+b.resilience, 0)}</span>
                       </h4>
                       {p.buildings.length === 0 && <p className="text-[11px] text-gray-300 italic text-center py-8">城市尚待開發...</p>}
                       {p.buildings.map(b => (
                         <div key={b.uuid} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
                            <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${b.type === 'build' ? 'bg-stone-200' : 'bg-emerald-100'}`}>
                                  {b.type === 'build' ? <Warehouse size={14} className="text-stone-500"/> : <Leaf size={14} className="text-emerald-600"/>}
                               </div>
                               <span className="text-xs font-bold text-gray-700">{b.name}</span>
                            </div>
                            <div className="flex gap-2 text-[10px] font-black">
                               <span className="text-blue-600 flex items-center gap-0.5"><Shield size={10}/> {b.resilience}</span>
                               <span className="text-red-600 flex items-center gap-0.5"><HeartCrack size={10}/> {b.hp}/{b.maxHp}</span>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                );
              })}
           </div>
        </section>

        {/* Action Panel */}
        <div className="w-full lg:w-96 bg-white border-l border-gray-200 p-6 shadow-2xl z-40 relative flex flex-col">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-lg"><Zap size={20}/></div>
              <div>
                <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">戰略控制台</h3>
                <p className="text-[10px] text-gray-400 font-bold">當前階段: {gameState.turnPhase === 2 ? '資源互動' : '城市建設'}</p>
              </div>
           </div>

           {!isMyTurn ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full bg-stone-50 border-4 border-stone-100 flex items-center justify-center transition-all ${isAiMoving ? 'scale-110 shadow-2xl' : ''}`}>
                    <Bot className={`text-stone-300 transition-all ${isAiMoving ? 'text-purple-500 rotate-12' : ''}`} size={48} />
                  </div>
                  {isAiMoving && (
                    <div className="absolute -inset-2 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin"></div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-black text-stone-800">對手思考中</p>
                  <p className="text-xs font-medium text-stone-400 mt-1 italic">正在向氣候資料庫調閱最佳策略...</p>
                </div>
             </div>
           ) : (
             <div className="space-y-6 flex-1">
                {gameState.turnPhase === 2 ? (
                  <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100 flex items-center gap-4">
                       <ArrowRightLeft className="text-orange-500" size={24}/>
                       <div className="text-sm">
                          <p className="font-black text-orange-900 leading-none">階段二：互動</p>
                          <p className="text-[10px] text-orange-700 mt-2 font-medium">您可以進行資源交換，或是掠奪鄰近區域的資源來加速建設。</p>
                       </div>
                    </div>
                    
                    {!interactionMode ? (
                      <div className="grid grid-cols-1 gap-3">
                        <button onClick={() => setInteractionMode(InteractionMode.PLUNDER)} className="group w-full py-5 px-6 rounded-3xl bg-red-50 text-red-600 font-black border border-red-100 hover:bg-red-600 hover:text-white transition-all flex items-center justify-between shadow-sm active:scale-95">
                           掠奪資源 <Zap size={18} className="group-hover:animate-bounce"/>
                        </button>
                        <button onClick={() => setInteractionMode(InteractionMode.BANK_TRADE)} className="group w-full py-5 px-6 rounded-3xl bg-blue-50 text-blue-600 font-black border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-between shadow-sm active:scale-95">
                           銀行交易 (3水 ➔ 1材) <Droplets size={18} className="group-hover:animate-pulse"/>
                        </button>
                        <button onClick={() => setGameState(prev => prev ? ({ ...prev, turnPhase: 3 }) : null)} className="w-full py-6 px-6 rounded-3xl bg-stone-900 text-white font-black hover:bg-black transition-all flex items-center justify-between shadow-xl active:scale-95">
                           直接進入建設階段 <Send size={18}/>
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 bg-stone-50 rounded-[2rem] border border-stone-200 space-y-5 animate-in slide-in-from-right duration-300 shadow-inner">
                         {interactionMode === InteractionMode.PLUNDER && (
                           <>
                              <h4 className="font-black text-xs text-red-600 uppercase tracking-widest">掠奪目標設定</h4>
                              <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">選擇鄰區</label>
                                <select 
                                  className="w-full p-4 rounded-2xl border border-stone-200 text-sm font-bold bg-white focus:ring-2 focus:ring-red-500 outline-none"
                                  value={targetPlayerId}
                                  onChange={e => setTargetPlayerId(e.target.value)}
                                >
                                  <option value="">-- 目標玩家 --</option>
                                  {gameState.players.filter(p => p.id !== currentPlayer.id).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">鎖定資源</label>
                                <div className="grid grid-cols-3 gap-2">
                                  {(['water', 'green', 'material'] as ResourceType[]).map(res => (
                                    <button 
                                      key={res} 
                                      onClick={() => setTargetResource(res)}
                                      className={`p-4 rounded-2xl border text-xs font-black transition-all ${targetResource === res ? 'bg-red-600 text-white border-red-600 shadow-lg scale-105' : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'}`}
                                    >
                                        {res === 'water' ? '水' : res === 'green' ? '綠' : '材'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleInteraction(InteractionMode.PLUNDER)}
                                className="w-full py-5 rounded-2xl bg-red-600 text-white font-black shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all mt-4"
                              >
                                發動掠奪行動
                              </button>
                           </>
                         )}

                         {interactionMode === InteractionMode.BANK_TRADE && (
                           <div className="text-center py-6">
                              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                 <Droplets className="text-blue-600" size={32}/>
                              </div>
                              <p className="text-sm font-bold text-gray-600 mb-8 leading-relaxed">
                                向銀行提交 <span className="text-blue-600 px-2 py-0.5 bg-blue-50 rounded">3 單位水資源</span><br/>
                                並換取 <span className="text-amber-700 px-2 py-0.5 bg-amber-50 rounded">1 單位建材資源</span>。
                              </p>
                              <button 
                                onClick={() => handleInteraction(InteractionMode.BANK_TRADE)}
                                className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                              >
                                確認兌換
                              </button>
                           </div>
                         )}

                         <button onClick={() => setInteractionMode(null)} className="w-full text-center text-xs text-gray-400 font-black hover:text-stone-600 tracking-wider uppercase">取消返回</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex items-center gap-4">
                       <ShoppingCart className="text-emerald-500" size={24}/>
                       <div className="text-sm">
                          <p className="font-black text-emerald-900 leading-none">階段三：城市建設</p>
                          <p className="text-[10px] text-emerald-700 mt-2 font-medium">請在左側市場選購卡牌。高等級建築雖然昂貴，但能大幅提升城市韌性。</p>
                       </div>
                    </div>

                    <div className="bg-stone-50 p-8 rounded-[2.5rem] border border-stone-200 text-center shadow-inner">
                       <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6 border border-stone-100">
                         <Warehouse className="text-stone-300" size={40} />
                       </div>
                       <p className="text-sm text-stone-600 font-bold leading-relaxed px-4">
                         建築的 <span className="text-blue-600">韌性值</span> 是抵禦氣候災害的唯一防線。<br/>
                         <span className="text-[10px] text-orange-500 font-black mt-4 block">注意：安裝空調雖能獲取積分，但會導致全球氣溫加速上升！</span>
                       </p>
                    </div>

                    <button 
                      onClick={() => {
                        addLog(`${currentPlayer.name} 結束了回合。`);
                        finishTurn(gameState.players, gameState.market, gameState.deck, false);
                      }} 
                      className="w-full py-6 rounded-3xl bg-stone-900 text-white font-black hover:bg-black transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                    >
                      結束當前回合 <RefreshCcw size={20}/>
                    </button>
                  </div>
                )}
             </div>
           )}

           <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center text-[10px] font-black text-gray-300 uppercase tracking-widest">
                 <span>玩家 ID: {currentPlayer.id}</span>
                 <span>Version 5.0.4</span>
              </div>
           </div>
        </div>
      </main>

      <footer className="h-10 bg-white border-t border-gray-100 flex items-center justify-center px-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] bg-stone-50">
        URBAN HEAT SURVIVAL • ADAPTATION STRATEGY • POWERED BY GEMINI 3.0
      </footer>
    </div>
  );
};

export default App;
