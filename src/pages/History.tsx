import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, RefreshCw, EyeOff, Eye, BookOpen, Search, Quote as QuoteIcon, Users, Lightbulb, MapPin, Tag, Skull, ListChecks, MessageCircle, Library, Plus, X, Download } from "lucide-react";
import { exportDossierPdf } from "@/lib/dossierPdf";
import { useLibrary } from "@/lib/storage";
import type { Book } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { generateDossier, loadDossier, loadDossierMap, saveDossierRemote, type BookDossier, type CachedDossier } from "@/lib/dossier";
import { searchOpenLibrary, type OLResult } from "@/lib/openlibrary";
import { cn } from "@/lib/utils";

type Filter = "all" | "finished" | "reading" | "rereading";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "finished", label: "Finished" },
  { key: "reading", label: "Reading" },
  { key: "rereading", label: "Rereading" },
];

// Unified card model — books from your shelf OR results pulled from the wider catalog.
interface AnyBook {
  id: string;            // stable dossier key
  title: string;
  author: string;
  year?: number;
  coverUrl?: string;
  spineColor?: string;
  source: "shelf" | "external";
  shelfBook?: Book;
}

const externalKey = (r: OLResult) => `ext:${r.isbn ?? r.key}`;

export default function History() {
  const { books } = useLibrary();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [haveDossier, setHaveDossier] = useState<Set<string>>(new Set());
  const [external, setExternal] = useState<OLResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const shelfCards: AnyBook[] = useMemo(() => books
    .filter(b => filter === "all" ? true : b.status === filter)
    .map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      year: b.year,
      coverUrl: b.coverUrl,
      spineColor: b.spineColor,
      source: "shelf" as const,
      shelfBook: b,
    })), [books, filter]);

  const filteredShelf = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shelfCards
      .filter(b => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => {
        const at = a.shelfBook?.lastOpenedAt ?? a.shelfBook?.addedAt ?? "";
        const bt = b.shelfBook?.lastOpenedAt ?? b.shelfBook?.addedAt ?? "";
        return bt.localeCompare(at);
      });
  }, [shelfCards, query]);

  // Universal search — when the query is non-empty, fetch external results too.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setExternal([]); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const results = await searchOpenLibrary(q, 18);
        if (seq !== searchSeq.current) return;
        // Drop any external result that duplicates a shelf book (by title+author)
        const shelfKeys = new Set(books.map(b => `${b.title.toLowerCase()}::${b.author.toLowerCase()}`));
        setExternal(results.filter(r => !shelfKeys.has(`${r.title.toLowerCase()}::${r.author.toLowerCase()}`)));
      } catch {
        if (seq === searchSeq.current) setExternal([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [query, books]);

  const externalCards: AnyBook[] = useMemo(() => external.map(r => ({
    id: externalKey(r),
    title: r.title,
    author: r.author,
    year: r.year,
    coverUrl: r.coverUrl,
    source: "external" as const,
  })), [external]);

  // Preload dossier indicators for everything currently visible
  useEffect(() => {
    let cancelled = false;
    const ids = [...filteredShelf.map(b => b.id), ...externalCards.map(b => b.id)];
    if (ids.length === 0) { setHaveDossier(new Set()); return; }
    loadDossierMap(ids).then(set => { if (!cancelled) setHaveDossier(set); });
    const refresh = () => loadDossierMap(ids).then(set => !cancelled && setHaveDossier(set));
    window.addEventListener("lexicon-dossier-change", refresh);
    return () => { cancelled = true; window.removeEventListener("lexicon-dossier-change", refresh); };
  }, [filteredShelf, externalCards]);

  const allCards = [...filteredShelf, ...externalCards];
  const openCard = allCards.find(c => c.id === openId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        eyebrow="The Memory Vault"
        title="Book History"
        subtitle="Every book you've lived inside — distilled into a dossier you can revisit forever. Search any book, even ones not on your shelf."
      />

      <div className="px-8 pb-12 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search any book — your shelf or the entire catalog…"
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-display tracking-wide border rounded-sm transition-colors",
                  filter === f.key
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredShelf.length === 0 && externalCards.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            <Library className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-display tracking-wide">{query ? "No matches yet — keep typing." : "Your vault is empty."}</p>
            <p className="text-xs mt-2">Search any book above to generate a dossier on the spot.</p>
          </Card>
        )}

        {filteredShelf.length > 0 && (
          <Section heading="From your shelf" count={filteredShelf.length}>
            <Grid cards={filteredShelf} have={haveDossier} onOpen={setOpenId} />
          </Section>
        )}

        {externalCards.length > 0 && (
          <Section heading="From the wider catalog" count={externalCards.length}>
            <Grid cards={externalCards} have={haveDossier} onOpen={setOpenId} />
          </Section>
        )}
      </div>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-none w-screen h-screen p-0 rounded-none border-0 sm:rounded-none">
          {openCard && <DossierFullScreen card={openCard} onClose={() => setOpenId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ heading, count, children }: { heading: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg tracking-wide">{heading}</h2>
        <span className="mono text-[0.6rem] tracking-[0.3em] text-muted-foreground uppercase">{count} volumes</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>
      {children}
    </section>
  );
}

function Grid({ cards, have, onOpen }: { cards: AnyBook[]; have: Set<string>; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {cards.map(b => (
        <BookCard key={b.id} card={b} hasDossier={have.has(b.id)} onClick={() => onOpen(b.id)} />
      ))}
    </div>
  );
}

function BookCard({ card, hasDossier, onClick }: { card: AnyBook; hasDossier: boolean; onClick: () => void }) {
  const [src, setSrc] = useState(card.coverUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(card.coverUrl); setFailed(false); }, [card.coverUrl]);
  const showImg = !!src && !failed;
  return (
    <button onClick={onClick} className="group text-left flex flex-col gap-2">
      <div className="relative aspect-[2/3] overflow-hidden border border-border bg-muted/30 rounded-sm shadow-sm group-hover:shadow-gold transition-all duration-300 group-hover:-translate-y-1">
        {showImg ? (
          <img
            src={src}
            alt={card.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center" style={{ background: card.spineColor ?? "hsl(var(--muted))" }}>
            <span className="font-display text-xs text-foreground/80 leading-tight line-clamp-6">{card.title}</span>
          </div>
        )}
        {hasDossier && (
          <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground rounded-full p-1 shadow-gold" title="Dossier saved">
            <Sparkles className="h-3 w-3" />
          </div>
        )}
        {card.source === "external" && (
          <div className="absolute top-2 left-2 bg-background/85 border border-border rounded-sm px-1.5 py-0.5 text-[0.55rem] mono tracking-[0.2em] uppercase">catalog</div>
        )}
      </div>
      <div className="px-1">
        <div className="font-display text-sm text-foreground truncate">{card.title}</div>
        <div className="text-[0.7rem] text-muted-foreground truncate">{card.author}{card.year ? ` · ${card.year}` : ""}</div>
      </div>
    </button>
  );
}

function DossierFullScreen({ card, onClose }: { card: AnyBook; onClose: () => void }) {
  const [cached, setCached] = useState<CachedDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"create" | "regenerate" | "extend" | null>(null);
  const [revealSpoilers, setRevealSpoilers] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setRevealSpoilers(false);
    setCached(null);
    (async () => {
      const existing = await loadDossier(card.id);
      if (cancelled) return;
      if (existing) {
        setCached(existing);
        setHydrated(true);
      } else {
        setHydrated(true);
        runGenerate("create");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const runGenerate = async (mode: "create" | "regenerate" | "extend") => {
    if (loading) return;
    setLoading(true);
    setLoadingMode(mode);
    try {
      const isExtend = mode === "extend";
      const { dossier, generatedAt } = await generateDossier({
        title: card.title,
        author: card.author,
        year: card.year,
        mode: isExtend ? "extend" : "create",
        existing: isExtend ? cached?.dossier : undefined,
      });
      const saved = await saveDossierRemote({
        bookId: card.id,
        title: card.title,
        author: card.author,
        dossier,
        generatedAt,
        isExtension: isExtend,
      });
      setCached(saved);
      toast.success(
        mode === "extend" ? "Dossier extended with new insights" :
        mode === "regenerate" ? "Dossier regenerated" :
        "Dossier ready — saved forever"
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate dossier");
    } finally {
      setLoading(false);
      setLoadingMode(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background">
      {/* Top bar */}
      <div className="flex items-start gap-5 px-6 lg:px-12 pt-6 pb-5 border-b border-border">
        <div className="w-24 lg:w-32 shrink-0 aspect-[2/3] overflow-hidden border border-border rounded-sm bg-muted/30 shadow-md">
          {card.coverUrl ? (
            <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[0.6rem] font-display p-2 text-center" style={{ background: card.spineColor ?? "hsl(var(--muted))" }}>{card.title}</div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <p className="mono text-[0.6rem] tracking-[0.3em] uppercase text-primary/80 mb-1">Memory Vault</p>
            <h1 className="font-display text-2xl lg:text-4xl tracking-wide leading-tight">{card.title}</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">{card.author}{card.year ? ` · ${card.year}` : ""}</p>
          </div>
          {cached && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[0.7rem] font-display tracking-wide" onClick={() => runGenerate("regenerate")} disabled={loading}>
                {loadingMode === "regenerate" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[0.7rem] font-display tracking-wide text-primary hover:text-primary" onClick={() => runGenerate("extend")} disabled={loading} title="Add new insights, deeper detail, fresh quotes">
                {loadingMode === "extend" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Extend
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[0.7rem] font-display tracking-wide" onClick={() => setRevealSpoilers(v => !v)}>
                {revealSpoilers ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {revealSpoilers ? "Spoilers on" : "Spoilers off"}
              </Button>
              {(cached.extensionCount ?? 0) > 0 && (
                <Badge variant="outline" className="text-[0.6rem] tracking-wide self-center">extended ×{cached.extensionCount}</Badge>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto">
          {!hydrated && (
            <div className="text-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
              <p className="text-xs font-display tracking-wide">Loading vault…</p>
            </div>
          )}
          {hydrated && !cached && loading && (
            <div className="text-center py-24 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-display text-base tracking-wide">Composing your dossier…</p>
              <p className="text-sm mt-2">First time only — saved forever after this. Usually 15–30 seconds.</p>
            </div>
          )}
          {hydrated && !cached && !loading && (
            <Card className="p-10 text-center border-dashed max-w-md mx-auto">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary opacity-70" />
              <p className="font-display text-base mb-3">Generation failed</p>
              <Button size="sm" onClick={() => runGenerate("create")}>Try again</Button>
            </Card>
          )}
          {cached && <DossierBody dossier={cached.dossier} revealSpoilers={revealSpoilers} generatedAt={cached.generatedAt} extendedAt={cached.extendedAt} />}
        </div>
      </ScrollArea>
    </div>
  );
}

function DossierBody({ dossier, revealSpoilers, generatedAt, extendedAt }: { dossier: BookDossier; revealSpoilers: boolean; generatedAt: string; extendedAt?: string }) {
  return (
    <div className="space-y-8">
      {/* Hero strip */}
      <div className="space-y-3 pb-5 border-b border-border">
        <p className="font-display text-xl lg:text-2xl italic text-foreground/90 leading-snug">
          “{dossier.oneLiner}”
        </p>
        <div className="flex flex-wrap gap-2">
          {dossier.genre && <Badge variant="outline" className="font-display tracking-wide">{dossier.genre}</Badge>}
          {dossier.setting && (
            <Badge variant="outline" className="font-display tracking-wide gap-1">
              <MapPin className="h-3 w-3" /> {dossier.setting}
            </Badge>
          )}
          {dossier.moodTags?.map(t => (
            <Badge key={t} variant="secondary" className="text-[0.65rem]">{t}</Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="essence" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4 h-auto flex-wrap">
          <TabsTrigger value="essence" className="text-xs">Essence</TabsTrigger>
          <TabsTrigger value="ideas" className="text-xs">Ideas</TabsTrigger>
          <TabsTrigger value="people" className="text-xs">People</TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs">Quotes</TabsTrigger>
          <TabsTrigger value="lessons" className="text-xs">Lessons</TabsTrigger>
          <TabsTrigger value="plot" className="text-xs">Plot</TabsTrigger>
        </TabsList>

        <TabsContent value="essence" className="space-y-6">
          <Block icon={<BookOpen className="h-4 w-4" />} title="Summary">
            <p className="text-sm lg:text-base leading-relaxed text-foreground/90">{dossier.summary}</p>
          </Block>
          {dossier.themes.length > 0 && (
            <Block icon={<Tag className="h-4 w-4" />} title="Themes">
              <div className="space-y-3">
                {dossier.themes.map((t, i) => (
                  <div key={i}>
                    <div className="font-display text-sm text-primary mb-1">{t.name}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                  </div>
                ))}
              </div>
            </Block>
          )}
          {dossier.symbols && dossier.symbols.length > 0 && (
            <Block icon={<Sparkles className="h-4 w-4" />} title="Symbols & Motifs">
              <div className="grid sm:grid-cols-2 gap-3">
                {dossier.symbols.map((s, i) => (
                  <Card key={i} className="p-3 bg-muted/20">
                    <div className="font-display text-sm mb-1">{s.symbol}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.meaning}</p>
                  </Card>
                ))}
              </div>
            </Block>
          )}
        </TabsContent>

        <TabsContent value="ideas" className="space-y-3">
          <p className="text-xs mono tracking-[0.25em] uppercase text-muted-foreground mb-3">Ideas to remember forever</p>
          {dossier.mainIdeas.map((idea, i) => (
            <Card key={i} className="p-4 border-l-4 border-l-primary/70">
              <div className="flex gap-3 items-start">
                <div className="font-display text-2xl text-primary/70 leading-none">{String(i + 1).padStart(2, "0")}</div>
                <div className="flex-1">
                  <div className="font-display text-base mb-1.5">{idea.idea}</div>
                  <p className="text-sm text-foreground/90 leading-relaxed mb-2">{idea.explanation}</p>
                  <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
                    Why it matters: {idea.whyItMatters}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="people" className="space-y-3">
          <Block icon={<Users className="h-4 w-4" />} title="Characters">
            <div className="space-y-3">
              {dossier.characters.map((c, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="font-display text-base">{c.name}</div>
                    <Badge variant="outline" className="text-[0.6rem] tracking-wide uppercase">{c.role}</Badge>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{c.description}</p>
                  {c.arc && <div className="mt-2 text-xs text-muted-foreground italic">Arc: {c.arc}</div>}
                </Card>
              ))}
            </div>
          </Block>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-3">
          <Block icon={<QuoteIcon className="h-4 w-4" />} title="Key Quotes">
            <div className="space-y-4">
              {dossier.keyQuotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-primary/60 pl-4 py-1">
                  <p className="font-display italic text-base leading-relaxed text-foreground/95">“{q.quote}”</p>
                  {q.context && <footer className="text-xs text-muted-foreground mt-2">— {q.context}</footer>}
                </blockquote>
              ))}
            </div>
          </Block>
        </TabsContent>

        <TabsContent value="lessons" className="space-y-6">
          <Block icon={<Lightbulb className="h-4 w-4" />} title="Lessons to Carry">
            <ul className="space-y-2">
              {dossier.lessons.map((l, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="text-primary font-display shrink-0">◆</span>
                  <span className="text-foreground/90">{l}</span>
                </li>
              ))}
            </ul>
          </Block>
          {dossier.discussionQuestions && dossier.discussionQuestions.length > 0 && (
            <Block icon={<MessageCircle className="h-4 w-4" />} title="Questions to Sit With">
              <ul className="space-y-2">
                {dossier.discussionQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-muted-foreground italic">— {q}</li>
                ))}
              </ul>
            </Block>
          )}
          {dossier.criticisms && dossier.criticisms.length > 0 && (
            <Block icon={<ListChecks className="h-4 w-4" />} title="Honest Critique">
              <ul className="space-y-1.5">
                {dossier.criticisms.map((c, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {c}</li>
                ))}
              </ul>
            </Block>
          )}
          {dossier.ifYouLiked && dossier.ifYouLiked.length > 0 && (
            <Block icon={<Library className="h-4 w-4" />} title="If You Liked This">
              <div className="grid sm:grid-cols-2 gap-2">
                {dossier.ifYouLiked.map((r, i) => (
                  <Card key={i} className="p-3 bg-muted/20">
                    <div className="font-display text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.author}</div>
                    <div className="text-xs mt-1.5 text-foreground/80 italic">{r.why}</div>
                  </Card>
                ))}
              </div>
            </Block>
          )}
        </TabsContent>

        <TabsContent value="plot" className="space-y-5">
          <SpoilerWrap revealed={revealSpoilers}>
            <Block icon={<ListChecks className="h-4 w-4" />} title="Plot Timeline">
              <ol className="space-y-3 relative border-l border-border ml-2 pl-5">
                {dossier.timeline.map((b, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-primary/70 shadow-gold" />
                    <div className="mono text-[0.6rem] tracking-[0.25em] uppercase text-primary mb-0.5">{b.act}</div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{b.event}</p>
                  </li>
                ))}
              </ol>
            </Block>
          </SpoilerWrap>
          {dossier.twists && dossier.twists.length > 0 && (
            <SpoilerWrap revealed={revealSpoilers}>
              <Block icon={<Skull className="h-4 w-4" />} title="Major Twists">
                <ul className="space-y-2">
                  {dossier.twists.map((t, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-relaxed">• {t}</li>
                  ))}
                </ul>
              </Block>
            </SpoilerWrap>
          )}
          {dossier.ending && (
            <SpoilerWrap revealed={revealSpoilers}>
              <Block icon={<BookOpen className="h-4 w-4" />} title="The Ending">
                <p className="text-sm text-foreground/90 leading-relaxed">{dossier.ending}</p>
              </Block>
            </SpoilerWrap>
          )}
        </TabsContent>
      </Tabs>

      <div className="pt-4 border-t border-border mono text-[0.6rem] tracking-[0.25em] uppercase text-muted-foreground">
        Dossier composed {new Date(generatedAt).toLocaleDateString()}{extendedAt ? ` · extended ${new Date(extendedAt).toLocaleDateString()}` : ""} · AI-generated, verify before quoting
      </div>
    </div>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-primary">
        {icon}
        <h3 className="font-display text-sm tracking-[0.2em] uppercase">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SpoilerWrap({ revealed, children }: { revealed: boolean; children: React.ReactNode }) {
  if (revealed) return <div className="animate-in fade-in duration-300">{children}</div>;
  return (
    <div className="relative">
      <div className="blur-md select-none pointer-events-none opacity-60">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/90 border border-border rounded-sm px-4 py-2 flex items-center gap-2 shadow-md">
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-display tracking-wide text-muted-foreground">Spoilers hidden — toggle to reveal</span>
        </div>
      </div>
    </div>
  );
}
