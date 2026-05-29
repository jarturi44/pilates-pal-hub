import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LoadingScreen, Wordmark } from "@/components/Wordmark";
import heroImg from "@/assets/landing-hero.jpg";
import {
  ArrowRight,
  Sunrise,
  Video,
  Package,
  PlayCircle,
  CheckCircle2,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pilates with Jon — Stronger, more flexible, more pain-free" },
      {
        name: "description",
        content:
          "Virtual pilates with Jon. One-on-one and small group sessions, 10 Minute Mornings, and a home equipment kit — built around you.",
      },
      { property: "og:title", content: "Pilates with Jon" },
      {
        property: "og:description",
        content:
          "Making you stronger, more flexible, and more pain-free. Virtual pilates programs built around you.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { loading, session, role } = useAuth();
  if (loading) return <LoadingScreen />;

  const primaryHref = session ? (role === "admin" ? "/dashboard" : "/home") : "/get-started";
  const primaryLabel = session ? "Go to your home" : "Book your intake";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav session={!!session} role={role} />
      <Hero primaryHref={primaryHref} primaryLabel={primaryLabel} />
      <MeetJon />
      <Programs />
      <DemoVideo />
      <Testimonials />
      <Contact />
      <Footer />
    </div>
  );
}

function Nav({ session, role }: { session: boolean; role: string | null }) {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Wordmark size="md" showText />
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#about" className="hover:text-foreground">About</a>
          <a href="#programs" className="hover:text-foreground">Programs</a>
          <a href="#demo" className="hover:text-foreground">See it</a>
          <a href="#testimonials" className="hover:text-foreground">Testimonials</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          {session ? (
            <Link
              to={role === "admin" ? "/dashboard" : "/home"}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-foreground hover:text-primary">
                Sign in
              </Link>
              <Link
                to="/get-started"
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">
            Pilates with Jon
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mt-4 text-foreground">
            Let's get you <em className="italic text-primary">stronger</em>, more{" "}
            <em className="italic text-primary">flexible</em>, and a whole lot more{" "}
            <em className="italic text-primary">pain‑free</em>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg">
            Hey, I'm Jon. I teach live pilates online — one‑on‑one and in small groups —
            built around your body, your schedule, and whatever you're working on. No
            studio commute, no guesswork. Just real progress.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to={primaryHref}
              className="inline-flex items-center gap-2 rounded-md bg-action text-action-foreground px-6 py-3 text-sm font-semibold hover:opacity-90"
            >
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#programs"
              className="text-sm font-medium text-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              See how it works
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-3 bg-primary/10 rounded-2xl rotate-1" aria-hidden />
          <img
            src={heroImg}
            alt="Pilates practice in a sunlit studio"
            className="relative rounded-2xl shadow-xl object-cover w-full aspect-[3/4]"
            width={1080}
            height={1440}
          />
        </div>
      </div>
    </section>
  );
}

function MeetJon() {
  return (
    <section id="about" className="border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">A little about me</p>
        <h2 className="font-display text-4xl md:text-5xl mt-4 text-foreground">
          I teach pilates that actually <em className="italic text-primary">listens</em> to your body.
        </h2>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          I've spent years helping people get out of pain, get strong, and feel at home
          in their bodies again. No two bodies are the same, so no two programs of mine
          look the same either. Whether you're brand new to pilates or you've been at it
          for years, I'll meet you exactly where you are — and we'll go from there,
          little by little.
        </p>
      </div>
    </section>
  );
}

function Programs() {
  return (
    <section id="programs" className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">How we'll work together</p>
          <h2 className="font-display text-4xl md:text-5xl mt-4 text-foreground">
            Two ways to move with me.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 gap-8">
          {/* 10 Minute Mornings */}
          <article className="rounded-2xl border border-border bg-background p-8 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-highlight/20 text-highlight-foreground p-2">
                <Sunrise className="h-5 w-5" />
              </span>
              <h3 className="font-display text-2xl text-foreground">10 Minute Mornings</h3>
            </div>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              A bi‑weekly pilates practice you do on your own — built to{" "}
              <span className="text-foreground font-medium">supplement your live sessions with me</span>{" "}
              and keep your body honest between workouts. 10 minutes, 10 exercises,
              and you'll feel better for the rest of your day.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              New to pilates? You can start right here as a standalone program. Once
              it starts to feel easy, that's your sign to level up — let's get you on
              live sessions where the real work happens.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-foreground">
              <Bullet>Short, focused sequences you'll actually finish</Bullet>
              <Bullet>Builds a daily habit without taking over your morning</Bullet>
              <Bullet>The easiest way to dip a toe into pilates</Bullet>
            </ul>
          </article>

          {/* Virtual Sessions */}
          <article className="rounded-2xl border border-primary/30 bg-primary text-primary-foreground p-8 flex flex-col shadow-lg">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary-foreground/15 p-2">
                <Video className="h-5 w-5" />
              </span>
              <h3 className="font-display text-2xl">Live Sessions with me</h3>
              <span className="ml-auto text-xs uppercase tracking-wider bg-action text-action-foreground px-2 py-1 rounded">
                Most popular
              </span>
            </div>
            <p className="mt-4 text-primary-foreground/85 leading-relaxed">
              30‑minute live sessions, 1–3 times a week —{" "}
              <span className="text-primary-foreground font-medium">one‑on‑one or small group</span>
              . After a virtual intake and evaluation, I build you a program around your
              body and whatever you're working on. We adjust as you grow.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <Bullet light>
                <strong className="font-semibold">An equipment kit shipped to your door</strong>
                <span className="inline-flex items-center gap-1 ml-2 text-primary-foreground/70">
                  <Package className="h-3.5 w-3.5" /> over $100 value, yours to keep
                </span>
              </Bullet>
              <Bullet light>
                <strong className="font-semibold">Warm‑up & cool‑down videos</strong> to do on
                your own before and after each live session
              </Bullet>
              <Bullet light>
                <strong className="font-semibold">10 Minute Mornings on the house</strong> — to
                keep the habit alive between our sessions
              </Bullet>
              <Bullet light>A program that grows with you, not against you</Bullet>
            </ul>
            <p className="mt-5 text-xs text-primary-foreground/70 italic">
              Live sessions require a 3‑month minimum commitment — that's how long it takes to really feel the change.
            </p>
            <Link
              to="/get-started"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-action text-action-foreground px-5 py-3 text-sm font-semibold hover:opacity-90"
            >
              Let's do this <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2
        className={`h-4 w-4 mt-0.5 shrink-0 ${light ? "text-highlight" : "text-accent"}`}
      />
      <span className={light ? "text-primary-foreground/90" : ""}>{children}</span>
    </li>
  );
}

function DemoVideo() {
  return (
    <section id="demo" className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">
            Take a look around
          </p>
          <h2 className="font-display text-4xl md:text-5xl mt-4 text-foreground">
            Here's what your home base looks like.
          </h2>
          <p className="mt-4 text-muted-foreground">
            A quick walkthrough of where you'll track your sessions, follow your
            program, and stay on rhythm between our live workouts.
          </p>
        </div>
        <div className="mt-10 relative aspect-video rounded-2xl border border-border bg-card overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8">
            <PlayCircle className="h-14 w-14 mx-auto text-primary/60" />
            <p className="mt-3 text-sm">Walkthrough video dropping soon</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    {
      quote:
        "I came in with chronic back pain. Six weeks later I'm sleeping through the night and walking taller.",
      name: "Sarah M.",
      detail: "One‑on‑one client",
    },
    {
      quote:
        "10 Minute Mornings is the only fitness habit I've ever actually kept. It's that good.",
      name: "Daniel R.",
      detail: "Mornings member",
    },
    {
      quote:
        "Jon programs like he knows my body better than I do. The small group format is magic.",
      name: "Priya K.",
      detail: "Small group client",
    },
  ];
  return (
    <section id="testimonials" className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">
            From the crew
          </p>
          <h2 className="font-display text-4xl md:text-5xl mt-4 text-foreground">
            Don't just take my word for it.
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="rounded-2xl border border-border bg-background p-6 flex flex-col"
            >
              <blockquote className="font-display text-xl text-foreground leading-snug">
                <span className="text-primary">“</span>
                {q.quote}
                <span className="text-primary">”</span>
              </blockquote>
              <figcaption className="mt-6 text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{q.name}</span> · {q.detail}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-accent font-medium">Say hi</p>
        <h2 className="font-display text-4xl md:text-5xl mt-4 text-foreground">
          Not sure where to start? I got you.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
          Shoot me a note and tell me what you're working on — pain, mobility, getting
          back into a routine, whatever it is. I'll personally write back with a real
          recommendation, no pressure.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="mailto:jon@pilateswithjon.com"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> jon@pilateswithjon.com
          </a>
          <Link
            to="/get-started"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Book your intake
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <Wordmark size="sm" />
          <span>© {new Date().getFullYear()} Pilates with Jon</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="hover:text-foreground">Sign in</Link>
          <Link to="/get-started" className="hover:text-foreground">Get started</Link>
        </div>
      </div>
    </footer>
  );
}
