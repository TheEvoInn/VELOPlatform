import React, { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, CheckCircle, X, ChevronDown, ChevronUp, Copy, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateAIContent, type GenerateContentParams } from '@/lib/api';
import { toast } from 'sonner';

export type AIFieldType =
  | 'bio'
  | 'headline'
  | 'skills'
  | 'experience_highlights'
  | 'tone_suggestions'
  | 'cover_letter_template'
  | 'resume_summary';

interface AIFieldGeneratorProps {
  fieldType: AIFieldType;
  currentValue?: string;
  identityContext: {
    full_name?: string;
    headline?: string;
    bio?: string;
    skills?: string[];
    years_experience?: number;
    location_country?: string;
    tone?: string;
    style?: string;
    category?: string;
  };
  onAccept: (value: string) => void;
  label?: string;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

const FIELD_PROMPTS: Record<AIFieldType, (ctx: AIFieldGeneratorProps['identityContext'], current: string) => { system: string; user: string }> = {
  bio: (ctx, current) => ({
    system: `You are a professional copywriter specializing in freelancer profiles and job applications. 
Write a compelling, authentic professional bio. 
STRICT RULES:
- Only use facts explicitly provided by the user. Never invent credentials, experiences, or skills.
- Enhance, expand, and professionalize — do not fabricate.
- Tone: ${ctx.tone || 'Professional'}. Style: ${ctx.style || 'Concise & Direct'}.
- Target length: 3-5 sentences, 80-120 words.
- Write in first person.
- Output ONLY the bio text — no labels, no preamble.`,
    user: `Name: ${ctx.full_name || 'Professional'}
Headline: ${ctx.headline || 'Skilled professional'}
Current bio: ${current || '(none provided)'}
Skills: ${(ctx.skills || []).join(', ') || 'not specified'}
Years of experience: ${ctx.years_experience || 0}
Location: ${ctx.location_country || 'not specified'}

Write a professional bio based ONLY on the information above. Enhance and expand it — do not invent details.`,
  }),

  headline: (ctx, current) => ({
    system: `You are a professional career coach writing optimized professional headlines for freelancers and job seekers.
STRICT RULES:
- Only use facts provided. Never invent skills or experience.
- Format: [Role] | [Key skill] | [Experience indicator]
- Keep it under 10 words.
- Be specific and compelling.
- Output ONLY the headline — no quotes, no extra text.`,
    user: `Current headline: ${current || '(none)'}
Skills: ${(ctx.skills || []).join(', ') || 'not specified'}
Years experience: ${ctx.years_experience || 0}
Bio context: ${ctx.bio || 'not provided'}

Write 3 headline variations (one per line), each under 10 words, based only on the provided information.`,
  }),

  skills: (ctx, current) => ({
    system: `You are a career skills consultant helping freelancers organize their skill sets.
STRICT RULES:
- Only suggest skills that are clearly implied by the user's headline, bio, and stated experience.
- Do NOT invent or assume skills not mentioned or implied.
- Organize into categories: Technical, Creative, Soft Skills, Tools & Platforms.
- Output as a comma-separated list of skills (no categories in the output, just skills).
- Max 20 skills total.`,
    user: `Headline: ${ctx.headline || 'Professional'}
Bio: ${ctx.bio || 'not provided'}
Current skills: ${current || (ctx.skills || []).join(', ') || 'not specified'}
Years experience: ${ctx.years_experience || 0}
Work category focus: ${ctx.category || 'general'}

Based ONLY on the above, suggest a comprehensive skills list as comma-separated values.`,
  }),

  experience_highlights: (ctx, current) => ({
    system: `You are a professional resume writer creating experience bullet points.
STRICT RULES:
- ONLY use facts and context explicitly provided by the user.
- Never invent job titles, companies, projects, or achievements.
- Format as 3-5 bullet points starting with action verbs.
- Each bullet: [Action verb] + [What you did] + [Result/context if provided].
- If no experience details are provided, create generic but honest placeholder bullets the user can customize.`,
    user: `Headline: ${ctx.headline || 'Professional'}
Bio: ${ctx.bio || 'not provided'}
Current experience notes: ${current || 'not provided'}
Skills: ${(ctx.skills || []).join(', ') || 'not specified'}
Years experience: ${ctx.years_experience || 0}

Write 3-5 professional experience bullet points based only on the above. Use [CUSTOMIZE] placeholders for details the user must fill in.`,
  }),

  tone_suggestions: (ctx, _current) => ({
    system: `You are a brand voice consultant. Suggest tone presets for a professional profile.
Output exactly 3 tone examples showing how the person's professional summary would sound in each tone.
Format each as:
**[Tone Name]**: [One-sentence example in that tone]`,
    user: `Headline: ${ctx.headline || 'Professional'}
Bio: ${ctx.bio || 'Experienced professional'}
Skills: ${(ctx.skills || []).slice(0, 5).join(', ')}
Current preferred tone: ${ctx.tone || 'Professional'}

Show 3 different tone variations (Professional, Bold/Confident, Friendly/Approachable) with a one-sentence example bio in each voice.`,
  }),

  cover_letter_template: (ctx, _current) => ({
    system: `You are a professional copywriter creating a reusable cover letter template for job applications.
Use placeholders like [Client Name], [Project Title], [Platform], [Skill], [Rate] for dynamic content.
Tone: ${ctx.tone || 'Professional'}. 
Length: 3 short paragraphs.
Make it compelling, specific, and application-ready.
Output ONLY the template text.`,
    user: `Name: ${ctx.full_name || ctx.headline || 'Professional'}
Headline: ${ctx.headline || 'Skilled professional'}
Bio: ${ctx.bio || 'Experienced professional'}
Top skills: ${(ctx.skills || []).slice(0, 5).join(', ')}
Tone preference: ${ctx.tone || 'Professional'}

Write a professional cover letter template using the above identity context.`,
  }),

  resume_summary: (ctx, _current) => ({
    system: `You are a professional resume writer. Write a concise, impactful resume summary section.
2-3 sentences max. Focus on value proposition.
Tone: ${ctx.tone || 'Professional'}.
Output ONLY the summary text — no labels or headers.`,
    user: `Name: ${ctx.full_name || 'Professional'}
Headline: ${ctx.headline || 'Skilled professional'}
Bio: ${ctx.bio || ''}
Skills: ${(ctx.skills || []).join(', ')}
Years experience: ${ctx.years_experience || 0}

Write a resume summary based only on this information.`,
  }),
};

const FIELD_LABELS: Record<AIFieldType, string> = {
  bio: 'Professional Bio',
  headline: 'Headline Variations',
  skills: 'Skills List',
  experience_highlights: 'Experience Bullets',
  tone_suggestions: 'Tone Previews',
  cover_letter_template: 'Cover Letter Template',
  resume_summary: 'Resume Summary',
};

export default function AIFieldGenerator({
  fieldType,
  currentValue = '',
  identityContext,
  onAccept,
  label,
  compact = false,
  className,
}: AIFieldGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [editedText, setEditedText] = useState('');

  const generate = useCallback(async () => {
    setGenerating(true);
    const prompts = FIELD_PROMPTS[fieldType](identityContext, currentValue);

    const params: GenerateContentParams = {
      content_type: 'raw' as Parameters<typeof generateAIContent>[0]['content_type'],
      context: {
        _raw_system: prompts.system,
        _raw_user: prompts.user,
        field_type: fieldType,
      },
      identity: {
        name: identityContext.full_name || identityContext.headline || 'Professional',
        persona: identityContext.bio || 'Experienced professional',
        tone: identityContext.tone || 'Professional',
        style: identityContext.style || 'Concise & Direct',
      },
    };

    const { text, error } = await generateAIContent(params);

    if (error) {
      toast.error('AI generation failed: ' + error);
      setGenerating(false);
      return;
    }

    const result = text || '';
    setGeneratedText(result);
    setEditedText(result);
    setHasGenerated(true);
    setGenerating(false);
  }, [fieldType, currentValue, identityContext]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasGenerated) {
      generate();
    }
  };

  const handleAccept = () => {
    const finalText = editedText || generatedText;
    if (!finalText) return;
    onAccept(finalText);
    toast.success(`${FIELD_LABELS[fieldType]} updated from AI`);
    setIsOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText || generatedText);
    toast.success('Copied to clipboard');
  };

  if (compact) {
    return (
      <div className={cn('inline-flex', className)}>
        <button
          onClick={handleOpen}
          disabled={generating}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all',
            'border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] text-[hsl(265,80%,70%)]',
            'hover:bg-[hsl(265_80%_55%/0.18)] hover:border-[hsl(265_80%_55%/0.5)]',
            'disabled:opacity-60'
          )}
        >
          {generating
            ? <RefreshCw size={9} className="animate-spin" />
            : <Sparkles size={9} />}
          {generating ? 'Generating...' : '✦ AI'}
        </button>

        {/* Floating panel */}
        {isOpen && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <div className="w-full max-w-lg mx-4 glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.3)] shadow-2xl shadow-[hsl(265_80%_55%/0.1)] slide-in-up" onClick={e => e.stopPropagation()}>
              <AIGeneratorPanel
                fieldType={fieldType}
                generating={generating}
                generatedText={editedText || generatedText}
                onTextChange={setEditedText}
                onRegenerate={generate}
                onAccept={handleAccept}
                onCopy={handleCopy}
                onClose={() => setIsOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        disabled={generating && !isOpen}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all w-full',
          isOpen
            ? 'border-[hsl(265_80%_55%/0.5)] bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)]'
            : 'border-[hsl(265_80%_55%/0.25)] bg-[hsl(265_80%_55%/0.06)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.12)] hover:border-[hsl(265_80%_55%/0.4)]'
        )}
      >
        <div className="flex items-center gap-1.5 flex-1">
          <Sparkles size={12} className={cn(isOpen && generating ? 'animate-pulse' : '')} />
          <span>✦ Generate {label || FIELD_LABELS[fieldType]} with AI</span>
        </div>
        <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </div>
      </button>

      {/* Inline expanded panel */}
      {isOpen && (
        <div className="rounded-xl border border-[hsl(265_80%_55%/0.25)] bg-[hsl(228_35%_4%)] overflow-hidden slide-in-up">
          <AIGeneratorPanel
            fieldType={fieldType}
            generating={generating}
            generatedText={editedText || generatedText}
            onTextChange={setEditedText}
            onRegenerate={generate}
            onAccept={handleAccept}
            onCopy={handleCopy}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Inner panel component ─────────────────────────────────────────────────────
interface PanelProps {
  fieldType: AIFieldType;
  generating: boolean;
  generatedText: string;
  onTextChange: (v: string) => void;
  onRegenerate: () => void;
  onAccept: () => void;
  onCopy: () => void;
  onClose: () => void;
}

function AIGeneratorPanel({ fieldType, generating, generatedText, onTextChange, onRegenerate, onAccept, onCopy, onClose }: PanelProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(265_80%_55%/0.06)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[hsl(265_80%_55%/0.2)] border border-[hsl(265_80%_55%/0.3)] flex items-center justify-center">
            <Wand2 size={12} className="text-[hsl(265,80%,70%)]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>
              ✦ AI Generator
            </div>
            <div className="text-[10px] text-muted-foreground">{FIELD_LABELS[fieldType]}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors">
          <X size={13} className="text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {generating ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-[hsl(265_80%_55%/0.2)] border-t-[hsl(265,80%,70%)] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={12} className="text-[hsl(265,80%,70%)]" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Gemini 3 Flash is generating your {FIELD_LABELS[fieldType].toLowerCase()}...
              <br />
              <span className="text-[10px] opacity-60">Using only your provided information</span>
            </div>
          </div>
        ) : generatedText ? (
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle size={10} className="text-[hsl(145,100%,55%)]" />
              Generated — edit before accepting
            </div>
            <textarea
              className="w-full px-3 py-3 rounded-xl bg-[hsl(228_35%_6%)] border border-[hsl(265_80%_55%/0.2)] text-xs leading-relaxed font-mono resize-none focus:outline-none focus:border-[hsl(265_80%_55%/0.45)] transition-colors"
              rows={fieldType === 'skills' ? 3 : fieldType === 'tone_suggestions' ? 6 : 7}
              value={generatedText}
              onChange={e => onTextChange(e.target.value)}
            />
            <div className="p-2.5 rounded-lg bg-[hsl(265_80%_55%/0.05)] border border-[hsl(265_80%_55%/0.12)] text-[10px] text-muted-foreground flex items-start gap-1.5">
              <Sparkles size={9} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
              AI only enhanced your provided information. Review and edit before saving.
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No content generated yet. Click Regenerate to try.
          </div>
        )}
      </div>

      {/* Actions */}
      {!generating && (
        <div className="flex items-center gap-2 px-4 pb-4">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={11} /> Regenerate
          </button>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy size={11} /> Copy
          </button>
          <button
            onClick={onAccept}
            disabled={!generatedText}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold ml-auto bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <CheckCircle size={11} /> Accept & Apply
          </button>
        </div>
      )}
    </div>
  );
}
