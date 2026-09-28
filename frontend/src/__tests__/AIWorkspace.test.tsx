import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { AIWorkspace } from '../pages/AIWorkspace';
import { renderRoute } from '../test/renderRoute';
import { agent, resetServiceMock } from '../test/serviceMock';
import { CLIENT, MOBILE, WEBSITE } from '../test/fixtures';

const ROUTE = '/clients/:clientId/ai';

function open(project = WEBSITE.slug) {
  return renderRoute(ROUTE, <AIWorkspace />, `/clients/c-vive/ai?project=${project}`);
}

/**
 * The AI workspace has to make the active project obvious, because the project
 * decides which of the client's memories the recommendation is allowed to use.
 */
describe('AIWorkspace — project context', () => {
  beforeEach(resetServiceMock);

  test('renders a project selector', async () => {
    open();
    expect(await screen.findByLabelText(/^project$/i)).toBeInTheDocument();
  });

  test('the project from the URL is the selected one', async () => {
    open();
    expect(await screen.findByLabelText(/^project$/i)).toHaveValue(WEBSITE.slug);
  });

  test('lists every project belonging to the client, and nothing else', async () => {
    open();
    const select = await screen.findByLabelText(/^project$/i);
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual([WEBSITE.name, MOBILE.name]);
  });

  test('selecting another project makes it the active one', async () => {
    const user = userEvent.setup();
    open();
    const select = await screen.findByLabelText(/^project$/i);

    await user.selectOptions(select, MOBILE.slug);

    expect(select).toHaveValue(MOBILE.slug);
    // The rest of the page follows: the memory context is the mobile project's.
    expect(await screen.findAllByText(/3 memories available to this project/)).not.toHaveLength(0);
  });

  test('the URL carries the active project, so the view is shareable', async () => {
    const user = userEvent.setup();
    const { search } = open();
    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    await waitFor(() => expect(search()).toContain(`project=${MOBILE.slug}`));
    expect(search()).not.toContain(WEBSITE.slug);
  });
});

describe('AIWorkspace — relevant memory count', () => {
  beforeEach(resetServiceMock);

  test('states the count as the active project’s relevant context', async () => {
    open();
    // 9 website decisions + 1 client-wide. Stated in the context bar and again on
    // the memory switch, so both places have to agree.
    expect(await screen.findAllByText(/10 memories available to this project/)).not.toHaveLength(0);
  });

  test('breaks the count down into project and client-wide memory', async () => {
    open();
    expect(await screen.findByText(/9 project decisions \+ 1 client-wide/)).toBeInTheDocument();
  });

  test('the count changes with the project', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    // 2 mobile decisions + the same 1 client-wide memory.
    expect(await screen.findAllByText(/3 memories available to this project/)).not.toHaveLength(0);
    expect(await screen.findByText(/2 project decisions \+ 1 client-wide/)).toBeInTheDocument();
  });

  test('never shows a sibling project’s count', async () => {
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText(/10 memories available to this project/);

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 memories available to this project/);

    expect(container.textContent).not.toMatch(/10 memories available to this project/);
  });
});

describe('AIWorkspace — generation uses the active project', () => {
  beforeEach(resetServiceMock);

  test('asks for a recommendation against the active project', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: WEBSITE.id, useMemory: true }),
    );
  });

  test('after switching project, the recommendation uses the NEW project', async () => {
    const user = userEvent.setup();
    open();
    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 memories available to this project/);

    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: MOBILE.id }),
    );
    expect(agent.recommend).not.toHaveBeenCalledWith(
      expect.objectContaining({ projectId: WEBSITE.id }),
    );
    expect(await screen.findByText(/Grounded direction for the mobile app/)).toBeInTheDocument();
  });

  test('a direction generated for one project is cleared when the project changes', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    expect(await screen.findByText(/Grounded direction for the website/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^project$/i), MOBILE.slug);

    // The website's direction must not sit under the mobile project's name.
    await waitFor(() =>
      expect(screen.queryByText(/Grounded direction for the website/)).not.toBeInTheDocument());
  });
});

describe('AIWorkspace — memory off', () => {
  beforeEach(resetServiceMock);

  test('generating with memory off uses no client history', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    await user.click(screen.getByRole('checkbox', { name: /client memory/i }));
    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(expect.objectContaining({ useMemory: false }));
    expect(await screen.findByText('Memory off')).toBeInTheDocument();
    expect(screen.getByText(/no previous decision from Vive Studio was recalled or used/i))
      .toBeInTheDocument();
  });

  test('switching project while memory is off does not switch memory back on', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    const toggle = screen.getByRole('checkbox', { name: /client memory/i });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    await user.selectOptions(screen.getByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 memories available to this project/);

    expect(screen.getByRole('checkbox', { name: /client memory/i })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: MOBILE.id, useMemory: false }),
    );
  });
});

/**
 * The memory OFF → ON comparison.
 *
 * Both sides must be generations that actually happened, for the same client,
 * project and request. Every refusal below matters as much as the match: an
 * unrelated comparison would be a fabricated claim about what memory did.
 */
describe('AIWorkspace — memory off vs on comparison', () => {
  beforeEach(() => {
    resetServiceMock();
    sessionStorage.clear();
  });

  const HEADING = /memory changes the direction/i;
  const GENERIC = /A generic direction with no client history\./;
  const GROUNDED_WEB = /Grounded direction for the website\./;

  /** Generate once at the current memory setting. */
  async function generate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Recommendation' })).toBeInTheDocument());
  }
  const toggleMemory = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('checkbox', { name: /client memory/i }));

  test('no comparison on a memory-off generation — there is nothing to compare yet', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);

    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('no comparison on a memory-on generation with no prior memory-off answer', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await generate(user);

    expect(await screen.findByText(GROUNDED_WEB)).toBeInTheDocument();
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('memory ON after memory OFF shows both REAL generated summaries', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GENERIC);

    await toggleMemory(user);
    await generate(user);

    // The comparison, with both sides being summaries the API returned.
    expect(await screen.findByText(HEADING)).toBeInTheDocument();
    const panel = screen.getByRole('region', { name: HEADING });
    expect(panel.textContent).toMatch(GENERIC);
    expect(panel.textContent).toMatch(GROUNDED_WEB);
    expect(panel.textContent).toMatch(/Grounded in 10 recalled memories/);
  });

  test('the normal recommendation, evidence and provenance remain below it', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);
    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GENERIC);
    await toggleMemory(user);
    await generate(user);
    await screen.findByText(HEADING);

    // The comparison is supporting context, not a replacement. The recalled count
    // appears twice by design: as the comparison's note and as the result's chip.
    expect(screen.getByRole('heading', { name: 'Recommendation' })).toBeInTheDocument();
    expect(screen.getAllByText(/Grounded in 10 recalled memories/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Recalled 10 memories from Vive Studio's Hindsight memory bank/))
      .toBeInTheDocument();
  });

  test('editing the request drops the comparison — a baseline answers ONE question', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GENERIC);

    await user.clear(screen.getByLabelText(/what should we do next/i));
    await user.type(screen.getByLabelText(/what should we do next/i), 'Draft the tone of voice.');
    await toggleMemory(user);
    await generate(user);

    await screen.findByText(GROUNDED_WEB);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('switching PROJECT does not carry the comparison across', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GENERIC);

    await user.selectOptions(screen.getByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 memories available to this project/);

    // Memory back on, in the OTHER project: the website baseline must not apply.
    await toggleMemory(user);
    await generate(user);

    expect(await screen.findByText(/Grounded direction for the mobile app\./)).toBeInTheDocument();
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('a baseline stored for another CLIENT is never shown', async () => {
    const user = userEvent.setup();
    // A memory-off baseline belonging to a different client, same project id and
    // same request — only the client differs.
    sessionStorage.setItem(
      `clientos:memory-off:other-client-id:${WEBSITE.id}`,
      JSON.stringify({
        request: 'create the next homepage direction',
        summary: 'A DIRECTION BELONGING TO ANOTHER CLIENT',
        recommendationId: 'rec_x',
      }),
    );

    open();
    await screen.findAllByText(/10 memories available to this project/);
    await generate(user);

    await screen.findByText(GROUNDED_WEB);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    expect(screen.queryByText(/ANOTHER CLIENT/)).not.toBeInTheDocument();
  });

  test('a baseline stored for another PROJECT is never shown', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      `clientos:memory-off:${CLIENT.client.id}:${MOBILE.id}`,
      JSON.stringify({
        request: 'create the next homepage direction',
        summary: 'A DIRECTION BELONGING TO THE MOBILE PROJECT',
        recommendationId: 'rec_y',
      }),
    );

    open();
    await screen.findAllByText(/10 memories available to this project/);
    await generate(user);

    await screen.findByText(GROUNDED_WEB);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    expect(screen.queryByText(/MOBILE PROJECT/)).not.toBeInTheDocument();
  });

  test('a failed memory-off generation is never stored as a baseline', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    agent.recommend.mockRejectedValueOnce(new Error('generation failed'));
    await toggleMemory(user);
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    await waitFor(() =>
      expect(screen.getByText(/No recommendation was generated/i)).toBeInTheDocument());

    // Nothing was stored, so the next memory-backed answer has nothing to pair with.
    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GROUNDED_WEB);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('memory ON that recalled nothing shows no comparison', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);
    await screen.findByText(GENERIC);

    // Memory on, but recall returned nothing: not a "with memory" difference.
    agent.recommend.mockResolvedValueOnce({
      recommendationId: 'r-empty', memoryUsed: false, memoryCount: 0, hindsightOk: true,
      summary: 'Nothing was recalled for this request.', items: [], avoid: [], notes: [],
      caveats: [], model: 'openai/gpt-oss-120b', latencyMs: 100,
    });
    await toggleMemory(user);
    await generate(user);

    expect(await screen.findByText(/Nothing was recalled for this request\./)).toBeInTheDocument();
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  test('memory OFF still produces zero evidence, and memory ON still produces real evidence', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    await toggleMemory(user);
    await generate(user);
    expect(await screen.findByText('0 client memories informed this recommendation'))
      .toBeInTheDocument();
    expect(screen.queryByText(/memory provenance/i)).not.toBeInTheDocument();

    await toggleMemory(user);
    await generate(user);
    await screen.findByText(HEADING);
    expect(screen.getAllByText(/Grounded in 10 recalled memories/)).not.toHaveLength(0);
    // Real provenance is reachable on the memory-backed answer.
    expect(screen.getAllByText(/memory provenance/i)).not.toHaveLength(0);
  });
});

/**
 * Memory → recalled decision → evidence → reasoning → recommendation.
 *
 * The page presents that chain in reverse (result first), so each link has to say
 * what it is. The risk being guarded here is a link claiming client history when
 * recall produced none.
 */
describe('AIWorkspace — memory → evidence → reasoning chain', () => {
  beforeEach(() => {
    resetServiceMock();
    sessionStorage.clear();
  });

  async function generate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Recommendation' })).toBeInTheDocument());
  }
  const toggleMemory = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('checkbox', { name: /client memory/i }));

  test('with memory, the reasoning is labelled as coming from recalled decisions', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);
    await generate(user);

    expect(await screen.findByText('From recalled client decisions')).toBeInTheDocument();
    expect(screen.getByText(/How Vive Studio's recorded decisions shaped each point/))
      .toBeInTheDocument();
  });

  test('with memory, the chain is stated from recommendation down to its source', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);
    await generate(user);

    // Top of the chain names the bank it recalled from...
    expect(await screen.findByText(/Recalled 10 memories from Vive Studio's Hindsight memory bank/))
      .toBeInTheDocument();
    // ...and the order of the three links is preserved.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    const iRec = headings.indexOf('Recommendation');
    const iWhy = headings.indexOf('Why this direction');
    const iEv = headings.indexOf('Client evidence');
    expect(iRec).toBeGreaterThanOrEqual(0);
    expect(iWhy).toBeGreaterThan(iRec);
    expect(iEv).toBeGreaterThan(iWhy);
  });

  test('WITHOUT memory the reasoning is labelled general practice, not client history', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);
    await toggleMemory(user);
    await generate(user);

    expect(await screen.findByText('General practice only')).toBeInTheDocument();
    expect(screen.getByText(/No decision of Vive Studio's informed these\s+points/))
      .toBeInTheDocument();
    // The memory-backed label must be absent entirely.
    expect(screen.queryByText('From recalled client decisions')).not.toBeInTheDocument();
    expect(screen.queryByText(/recorded decisions shaped each point/)).not.toBeInTheDocument();
  });

  test('memory ON that recalled nothing makes no "based on memory" claim', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 memories available to this project/);

    agent.recommend.mockResolvedValueOnce({
      recommendationId: 'r-empty', memoryUsed: false, memoryCount: 0, hindsightOk: true,
      summary: 'Nothing was recalled for this request.',
      items: [{ id: 'i1', text: 'A general point.', rationale: 'r', why: 'w', evidence: [] }],
      avoid: [], notes: [], caveats: [], model: 'openai/gpt-oss-120b', latencyMs: 100,
    });
    await generate(user);

    expect(await screen.findByText('General practice only')).toBeInTheDocument();
    expect(screen.queryByText('From recalled client decisions')).not.toBeInTheDocument();
  });
});
