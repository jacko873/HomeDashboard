import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  ShoppingBag, 
  Check, 
  Plus, 
  RotateCcw,
  Egg,
  Apple,
  UtensilsCrossed,
  PackageCheck
} from 'lucide-react';
import { GroceryCategory, GroceryItem } from '../types';

export default function GroceryDashboard() {
  const [categories, setCategories] = useState<GroceryCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroceryData() {
      try {
        const localGroceryRaw = localStorage.getItem('grocery_shelf_data');
        if (localGroceryRaw) {
          setCategories(JSON.parse(localGroceryRaw));
        } else {
          const response = await fetch(apiUrl('/api/grocery'));
          const data = await response.json();
          setCategories(data.categories);
          localStorage.setItem('grocery_shelf_data', JSON.stringify(data.categories));
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching grocery list: ', err);
        setLoading(false);
      }
    }
    loadGroceryData();
  }, []);

  const toggleItemBought = (catName: string, itemId: string) => {
    const updated = categories.map((cat) => {
      if (cat.name === catName) {
        const updatedItems = cat.items.map((item) => {
          if (item.id === itemId) {
            return { ...item, bought: !item.bought };
          }
          return item;
        });
        return { ...cat, items: updatedItems };
      }
      return cat;
    });

    setCategories(updated);
    localStorage.setItem('grocery_shelf_data', JSON.stringify(updated));
  };

  const getCategoryIcon = (catName: string) => {
    if (catName.includes('Produce')) return <Apple className="w-5 h-5 text-emerald-450 text-emerald-400" />;
    if (catName.includes('Dairy')) return <Egg className="w-5 h-5 text-amber-400" />;
    if (catName.includes('Pantry')) return <UtensilsCrossed className="w-5 h-5 text-orange-400" />;
    return <ShoppingBag className="w-5 h-5 text-[#a5b4fc]" />;
  };

  const resetCheckedItems = () => {
    const updated = categories.map((cat) => {
      const resetItems = cat.items.map((item) => ({ ...item, bought: false }));
      return { ...cat, items: resetItems };
    });
    setCategories(updated);
    localStorage.setItem('grocery_shelf_data', JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/25 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing kitchen food list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Background soft lighting */}
      <div className="absolute top-0 left-1/3 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header section with Reset button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-11 border-b border-white/5 pb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase shadow-[0_0_5px_rgba(16,185,129,0.2)]">Smart Home fridge node</p>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white">Grocery Pantry</h2>
        </div>
        
        <button 
          onClick={resetCheckedItems}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition-all text-xs font-mono font-bold uppercase text-slate-300 hover:text-emerald-400 backdrop-blur-md active:scale-98"
        >
          <RotateCcw className="w-4.5 h-4.5" />
          <span>Reset checkout</span>
        </button>
      </div>

      {/* Grid containing categorized grocery cells */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        {categories.map((cat, catIdx) => {
          const totalItemsCount = cat.items.length;
          const boughtItemsCount = cat.items.filter((i) => i.bought).length;
          
          return (
            <div 
              key={catIdx} 
              className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between hover:border-emerald-500/10 transition-all duration-300"
            >
              <div>
                {/* Category Header Card */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5 shrink-0">
                      {getCategoryIcon(cat.name)}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-white font-display">{cat.name}</h3>
                  </div>
                  
                  <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-white/5 border border-white/5 text-emerald-400 uppercase tracking-wider">
                    {boughtItemsCount} / {totalItemsCount} Acquired
                  </span>
                </div>

                {/* Items rows inside category */}
                <div className="space-y-3">
                  {cat.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItemBought(cat.name, item.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 ${
                        item.bought 
                          ? 'bg-black/15 border-white/0 opacity-40' 
                          : 'bg-black/25 border-white/5 hover:border-emerald-500/10 hover:bg-white/[0.01]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Interactive item checklist check circle */}
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          item.bought 
                            ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' 
                            : 'border-white/10 bg-[#07080b] text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3.5px] shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                        </div>
                        
                        <span className={`text-base font-semibold truncate leading-tight transition-all font-sans ${
                          item.bought ? 'line-through text-slate-500 font-normal' : 'text-slate-200'
                        }`}>
                          {item.name}
                        </span>
                      </div>
                      
                      <span className="text-xs font-mono text-slate-500 shrink-0 font-bold ml-4">
                        {item.qty}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Progress bar inside category bottom block */}
              <div className="mt-8 pt-4 border-t border-white/5">
                <div className="w-full bg-black/40 border border-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full transition-all duration-750 shadow-md shadow-emerald-500/30" 
                    style={{ width: `${(boughtItemsCount / totalItemsCount) * 100}%` }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
