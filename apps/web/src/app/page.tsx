'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './landing.module.css';

type Step = {
  step: string;
  title: string;
  copy: string;
  status: string;
  shortTitle: string;
  shortCopy: string;
};

const storySteps: Step[] = [
  {
    step: '1',
    title: 'Record the workflow',
    copy: 'Capture the task once in teach mode, exactly the way your team already performs it.',
    status: 'Step 1 of 4',
    shortTitle: 'Record once',
    shortCopy: 'Show the task once. No script writing, no technical setup maze.',
  },
  {
    step: '2',
    title: 'Prepare reusable steps',
    copy: 'memoo structures actions into reusable workflow steps and detects variable inputs.',
    status: 'Step 2 of 4',
    shortTitle: 'Structure and prepare',
    shortCopy: 'Your process becomes repeatable logic your team can trust.',
  },
  {
    step: '3',
    title: 'Execute at scale',
    copy: 'Run the same workflow in batch for records, rows, or lists while keeping consistent quality.',
    status: 'Step 3 of 4',
    shortTitle: 'Run many times',
    shortCopy: 'Scale repetitive work without repeating repetitive clicks.',
  },
  {
    step: '4',
    title: 'Share with coworkers',
    copy: 'Playbooks can be shared and reused across teams, so operations stay aligned.',
    status: 'Step 4 of 4',
    shortTitle: 'Share and align',
    shortCopy: 'One workflow, one standard, many teammates.',
  },
];

const logos = [
  { slug: 'googledrive', name: 'Drive' },
  { slug: 'googlesheets', name: 'Sheets' },
  { slug: 'googleslides', name: 'Slides' },
  { slug: 'gmail', name: 'Gmail' },
  { slug: 'googlecalendar', name: 'Calendar' },
  { slug: 'googlemeet', name: 'Meet' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'hubspot', name: 'HubSpot' },
  { slug: 'zendesk', name: 'Zendesk' },
  { slug: 'jira', name: 'Jira' },
  { slug: 'asana', name: 'Asana' },
  { slug: 'stripe', name: 'Stripe' },
  { slug: 'shopify', name: 'Shopify' },
  { slug: 'intercom', name: 'Intercom' },
  { slug: 'zapier', name: 'Zapier' },
  { slug: 'airtable', name: 'Airtable' },
  { slug: 'trello', name: 'Trello' },
  { slug: 'clickup', name: 'ClickUp' },
];

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).map(name => styles[name as string]).join(' ');
}

function probeImage(path: string, onSuccess: () => void, onError: () => void) {
  const probe = new window.Image();
  probe.onload = onSuccess;
  probe.onerror = onError;
  probe.src = path;
}

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [hideTopbar, setHideTopbar] = useState(false);
  const [heroGifReady, setHeroGifReady] = useState(false);
  const [storyGifReady, setStoryGifReady] = useState(false);
  const storyRef = useRef<HTMLElement | null>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const currentStep = storySteps[activeStep] ?? storySteps[0];

  const duplicatedLogos = useMemo(() => [...logos, ...logos], []);

  useEffect(() => {
    probeImage('/assets/hero-preview.gif', () => setHeroGifReady(true), () => setHeroGifReady(false));
    probeImage('/assets/story-preview.gif', () => setStoryGifReady(true), () => setStoryGifReady(false));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return;
          }
          const index = Number((entry.target as HTMLElement).dataset.index ?? 0);
          setActiveStep(index);
        });
      },
      {
        threshold: 0.6,
        rootMargin: '-10% 0px -25% 0px',
      }
    );

    stepRefs.current.forEach(step => {
      if (step) {
        observer.observe(step);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateTopbarVisibility = () => {
      const section = storyRef.current;
      if (!section) {
        return;
      }
      const rect = section.getBoundingClientRect();
      const triggerLine = 96;
      const isInStory = rect.top <= triggerLine && rect.bottom > triggerLine;
      setHideTopbar(isInStory);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        updateTopbarVisibility();
        ticking = false;
      });
    };

    updateTopbarVisibility();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateTopbarVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateTopbarVisibility);
    };
  }, []);

  return (
    <div className={cx('landing-root')}>
      <header className={cx('topbar', 'container', hideTopbar && 'topbar-hidden')}>
        <a className={cx('brand')} href="#">
          <span className={cx('brand-mark')} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>memoo</span>
        </a>
        <nav className={cx('topnav')} aria-label="Primary">
          <a href="#story">How it works</a>
          <a href="#proof">Proof</a>
          <a href="/login">Demo access</a>
        </nav>
        <div className={cx('topbar-actions')}>
          <a className={cx('btn', 'btn-soft')} href="#story">
            How it works
          </a>
          <a className={cx('btn', 'btn-primary')} href="/login">
            Enter with code
          </a>
        </div>
      </header>

      <main>
        <section className={cx('hero', 'container')}>
          <div className={cx('hero-copy')}>
            <p className={cx('kicker')}>Browser workflow automation for business teams</p>
            <h1>Record it once. Run it a thousand times.</h1>
            <p className={cx('lead')}>
              A simple operational layer for repeated web tasks. Capture the process, execute at scale, and share the
              same playbook with coworkers.
            </p>
            <div className={cx('hero-actions')}>
              <a className={cx('btn', 'btn-ghost')} href="#story">
                See how it works
              </a>
              <a className={cx('btn', 'btn-primary')} href="/login">
                Use invite code
              </a>
            </div>
          </div>

          <aside className={cx('hero-preview')}>
            <p className={cx('preview-chip')}>Preview</p>
            <div className={cx('hero-gif-slot')}>
              {heroGifReady ? <img src="/assets/hero-preview.gif" alt="memoo hero preview" /> : null}
              {!heroGifReady ? (
                <div className={cx('gif-fallback')}>
                  <p>Drop your hero GIF preview here.</p>
                  <code>public/assets/hero-preview.gif</code>
                </div>
              ) : null}
            </div>
            <p className={cx('hero-preview-note')}>Hero preview can be different from the scrollytelling demo below.</p>
          </aside>
        </section>

        <section className={cx('hero-space', 'container')}>
          <div className={cx('hero-space-line')} />
          <p>Scroll to walk through how one workflow becomes reusable across your team.</p>
        </section>

        <section className={cx('logos', 'container')}>
          <p className={cx('logos-note')}>Works with tools your team already uses</p>
          <div className={cx('logo-marquee')} aria-label="Compatible tools logos">
            <div className={cx('logo-track')}>
              {duplicatedLogos.map((logo, idx) => (
                <span key={`${logo.slug}-${idx}`} className={cx('logo-pill')} aria-hidden={idx >= logos.length}>
                  <img
                    src={`https://cdn.simpleicons.org/${logo.slug}`}
                    alt={idx >= logos.length ? '' : `${logo.name} logo`}
                  />
                  <strong>{logo.name}</strong>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="story" ref={storyRef} className={cx('story', 'container')}>
          <div className={cx('story-shell')}>
            <div className={cx('story-steps')}>
              {storySteps.map((step, idx) => (
                <article
                  key={step.step}
                  ref={node => {
                    stepRefs.current[idx] = node;
                  }}
                  data-index={idx}
                  className={cx('story-step', activeStep === idx && 'active')}
                >
                  <p className={cx('step-num')}>{step.step.padStart(2, '0')}</p>
                  <h2>{step.shortTitle}</h2>
                  <p>{step.shortCopy}</p>
                </article>
              ))}
            </div>

            <aside className={cx('story-preview')} aria-live="polite">
              <div className={cx('story-progress')}>
                <span style={{ width: `${(activeStep + 1) * 25}%` }} />
              </div>
              <p className={cx('preview-status')}>{currentStep.status}</p>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.copy}</p>

              <div className={cx('gif-slot')}>
                {storyGifReady ? <img src="/assets/story-preview.gif" alt="memoo story preview" /> : null}
                {!storyGifReady ? (
                  <div className={cx('gif-fallback')}>
                    <p>Preview area for your product GIF</p>
                    <code>public/assets/story-preview.gif</code>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </section>

        <section id="proof" className={cx('proof', 'container')}>
          <h2>What teams say after switching repetitive workflows to memoo</h2>
          <div className={cx('proof-grid')}>
            <article>
              <img src="https://i.pravatar.cc/96?img=12" alt="Ariana Voss" />
              <p>
                &quot;We replaced weekly copy-paste routines with one shared playbook. The team now runs the same
                process with less rework.&quot;
              </p>
              <strong>Ariana Voss</strong>
              <span>HR Operations Manager</span>
            </article>

            <article>
              <img src="https://i.pravatar.cc/96?img=33" alt="Marco Ilan" />
              <p>
                &quot;The main benefit is consistency. Different people now execute the same finance workflow the same
                way.&quot;
              </p>
              <strong>Marco Ilan</strong>
              <span>Finance Operations Lead</span>
            </article>

            <article>
              <img src="https://i.pravatar.cc/96?img=47" alt="Nina Calder" />
              <p>
                &quot;Support handoffs are faster because everyone can reuse playbooks instead of reinventing steps each
                day.&quot;
              </p>
              <strong>Nina Calder</strong>
              <span>Customer Support Supervisor</span>
            </article>
          </div>
        </section>

        <section id="final-cta" className={cx('final-cta', 'container')}>
          <h2>Bring one workflow. Leave with a repeatable system.</h2>
          <p>We will map one recurring process and show how your team can scale it.</p>
          <a className={cx('btn', 'btn-primary')} href="/login">
            Enter the demo
          </a>
        </section>
      </main>

      <footer className={cx('footer', 'container')}>
        <div className={cx('footer-top')}>
          <div className={cx('footer-brand')}>
            <a className={cx('brand')} href="#">
              <span className={cx('brand-mark')} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>memoo</span>
            </a>
            <p>Operational playbooks for recurring web workflows.</p>
          </div>

          <div className={cx('footer-links')}>
            <div>
              <h4>Product</h4>
              <a href="#story">How it works</a>
              <a href="/login">Demo access</a>
              <a href="#">Use cases</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Security</a>
              <a href="#">Contact</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="#">Documentation</a>
              <a href="#">Playbook templates</a>
              <a href="#">Status</a>
            </div>
          </div>
        </div>

        <div className={cx('footer-bottom')}>
          <p>(c) 2026 memoo, Inc.</p>
          <div>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
