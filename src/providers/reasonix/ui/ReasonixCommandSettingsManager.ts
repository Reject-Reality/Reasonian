import type { App } from 'obsidian';
import { Modal, Notice, Setting, setIcon } from 'obsidian';

import type { ProviderCommandEntry, ProviderCommandKind } from '../../../core/providers/commands/ProviderCommandEntry';
import { ReasonixCommandCatalog } from '../app/ReasonixCommandCatalog';
import { trReasonix } from './reasonixI18n';

const PROVIDER_ID = 'reasonix';

function splitList(value: string): string[] | undefined {
  const items = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseHooks(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(trReasonix('validationHooksObject'));
  }

  return parsed as Record<string, unknown>;
}

class ReasonixCommandEntryModal extends Modal {
  private kind: ProviderCommandKind;
  private name = '';
  private description = '';
  private argumentHint = '';
  private content = '';
  private allowedTools = '';
  private model = '';
  private disableModelInvocation = false;
  private userInvocable = true;
  private hooks = '';
  private nameInputEl: HTMLInputElement | null = null;

  constructor(
    app: App,
    private readonly entry: ProviderCommandEntry | null,
    initialKind: ProviderCommandKind,
    private readonly onSave: (entry: ProviderCommandEntry) => Promise<void>,
  ) {
    super(app);
    this.kind = entry?.kind ?? initialKind;

    if (entry) {
      this.name = entry.name;
      this.description = entry.description ?? '';
      this.argumentHint = entry.argumentHint ?? '';
      this.content = entry.content;
      this.allowedTools = entry.allowedTools?.join('\n') ?? '';
      this.model = entry.model ?? '';
      this.disableModelInvocation = entry.disableModelInvocation === true;
      this.userInvocable = entry.userInvocable !== false;
      this.hooks = entry.hooks ? JSON.stringify(entry.hooks, null, 2) : '';
    }
  }

  onOpen(): void {
    this.setTitle(this.entry ? trReasonix('modalEditTitle') : trReasonix('modalAddTitle'));
    this.modalEl.addClass('claudian-mcp-modal');

    const { contentEl } = this;

    new Setting(contentEl)
      .setName(trReasonix('modalTypeName'))
      .setDesc(trReasonix('modalTypeDesc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('command', trReasonix('commandType'))
          .addOption('skill', trReasonix('skillType'))
          .setValue(this.kind)
          .onChange((value) => {
            this.kind = value as ProviderCommandKind;
          });
      });

    new Setting(contentEl)
      .setName(trReasonix('modalNameName'))
      .setDesc(trReasonix('modalNameDesc'))
      .addText((text) => {
        this.nameInputEl = text.inputEl;
        text
          .setPlaceholder(this.kind === 'skill'
            ? trReasonix('modalNamePlaceholderSkill')
            : trReasonix('modalNamePlaceholderCommand'))
          .setValue(this.name)
          .onChange((value) => {
            this.name = value;
          });
        text.inputEl.addEventListener('keydown', (event) => this.handleKeyDown(event));
      });

    new Setting(contentEl)
      .setName(trReasonix('modalDescriptionName'))
      .setDesc(trReasonix('modalDescriptionDesc'))
      .addText((text) => text
        .setPlaceholder(trReasonix('modalDescriptionPlaceholder'))
        .setValue(this.description)
        .onChange((value) => {
          this.description = value;
        }));

    new Setting(contentEl)
      .setName(trReasonix('modalArgumentHintName'))
      .setDesc(trReasonix('modalArgumentHintDesc'))
      .addText((text) => text
        .setPlaceholder(trReasonix('modalArgumentHintPlaceholder'))
        .setValue(this.argumentHint)
        .onChange((value) => {
          this.argumentHint = value;
        }));

    const contentSetting = new Setting(contentEl)
      .setName(trReasonix('modalPromptTemplateName'))
      .setDesc(trReasonix('modalPromptTemplateDesc'));
    contentSetting.settingEl.addClass('claudian-mcp-env-setting');
    const contentTextarea = contentSetting.controlEl.createEl('textarea', {
      cls: 'claudian-mcp-env-textarea',
    });
    contentTextarea.rows = 8;
    contentTextarea.value = this.content;
    contentTextarea.placeholder = trReasonix('modalPromptTemplatePlaceholder');
    contentTextarea.addEventListener('input', () => {
      this.content = contentTextarea.value;
    });

    this.renderAdvancedFields(contentEl);

    const buttonContainer = contentEl.createDiv({ cls: 'claudian-mcp-buttons' });
    const cancelBtn = buttonContainer.createEl('button', {
      text: trReasonix('modalCancel'),
      cls: 'claudian-cancel-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: this.entry ? trReasonix('modalUpdate') : trReasonix('modalAdd'),
      cls: 'claudian-save-btn mod-cta',
    });
    saveBtn.addEventListener('click', () => {
      void this.save();
    });

    setTimeout(() => this.nameInputEl?.focus(), 50);
  }

  private renderAdvancedFields(contentEl: HTMLElement): void {
    const advancedEl = contentEl.createDiv({ cls: 'claudian-mcp-type-fields' });

    const noteEl = advancedEl.createDiv({ cls: 'claudian-mcp-empty' });
    noteEl.setText(
      'Reasonian stores vault templates as lightweight Reasonix launch prompts. Advanced agent and fork fields are treated as compatibility metadata, not active MVP execution features.'
    );

    new Setting(advancedEl)
      .setName(trReasonix('modalModelName'))
      .setDesc(trReasonix('modalModelDesc'))
      .addText((text) => text
        .setPlaceholder(trReasonix('modalModelPlaceholder'))
        .setValue(this.model)
        .onChange((value) => {
          this.model = value;
        }));

    const toolsSetting = new Setting(advancedEl)
      .setName(trReasonix('modalAllowedToolsName'))
      .setDesc(trReasonix('modalAllowedToolsDesc'));
    toolsSetting.settingEl.addClass('claudian-mcp-env-setting');
    const toolsTextarea = toolsSetting.controlEl.createEl('textarea', {
      cls: 'claudian-mcp-env-textarea',
    });
    toolsTextarea.rows = 3;
    toolsTextarea.value = this.allowedTools;
    toolsTextarea.placeholder = trReasonix('modalAllowedToolsPlaceholder');
    toolsTextarea.addEventListener('input', () => {
      this.allowedTools = toolsTextarea.value;
    });

    new Setting(advancedEl)
      .setName(trReasonix('modalUserInvocableName'))
      .setDesc(trReasonix('modalUserInvocableDesc'))
      .addToggle((toggle) => toggle
        .setValue(this.userInvocable)
        .onChange((value) => {
          this.userInvocable = value;
        }));

    new Setting(advancedEl)
      .setName(trReasonix('modalDisableModelInvocationName'))
      .setDesc(trReasonix('modalDisableModelInvocationDesc'))
      .addToggle((toggle) => toggle
        .setValue(this.disableModelInvocation)
        .onChange((value) => {
          this.disableModelInvocation = value;
        }));

    const hooksSetting = new Setting(advancedEl)
      .setName(trReasonix('modalHooksName'))
      .setDesc(trReasonix('modalHooksDesc'));
    hooksSetting.settingEl.addClass('claudian-mcp-env-setting');
    const hooksTextarea = hooksSetting.controlEl.createEl('textarea', {
      cls: 'claudian-mcp-env-textarea',
    });
    hooksTextarea.rows = 3;
    hooksTextarea.value = this.hooks;
    hooksTextarea.placeholder = trReasonix('modalHooksPlaceholder');
    hooksTextarea.addEventListener('input', () => {
      this.hooks = hooksTextarea.value;
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.save();
    } else if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      this.close();
    }
  }

  private async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      new Notice(trReasonix('validationNameRequired'));
      this.nameInputEl?.focus();
      return;
    }

    if (!this.content.trim()) {
      new Notice(trReasonix('validationPromptRequired'));
      return;
    }

    let hooks: Record<string, unknown> | undefined;
    try {
      hooks = parseHooks(this.hooks);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : trReasonix('validationInvalidHooks'));
      return;
    }

    const entry: ProviderCommandEntry = {
      id: this.entry?.id ?? `reasonix:${this.kind}:${name}`,
      providerId: PROVIDER_ID,
      kind: this.kind,
      name,
      description: this.description.trim() || undefined,
      content: this.content,
      argumentHint: this.argumentHint.trim() || undefined,
      allowedTools: splitList(this.allowedTools),
      model: this.model.trim() || undefined,
      disableModelInvocation: this.disableModelInvocation ? true : undefined,
      userInvocable: this.userInvocable,
      context: undefined,
      agent: undefined,
      hooks,
      scope: 'vault',
      source: 'user',
      isEditable: true,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
      persistenceKey: this.entry?.persistenceKey,
    };

    try {
      await this.onSave(entry);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : trReasonix('noticeSaveFailed'));
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ReasonixCommandSettingsManager {
  constructor(
    private readonly containerEl: HTMLElement,
    private readonly app: App,
    private readonly commandCatalog: ReasonixCommandCatalog,
  ) {
    void this.render();
  }

  async render(): Promise<void> {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: 'claudian-mcp-header' });
    headerEl.createSpan({ text: trReasonix('commandsHeader'), cls: 'claudian-mcp-label' });

    const actionsEl = headerEl.createDiv({ cls: 'claudian-mcp-add-container' });
    this.addHeaderButton(actionsEl, trReasonix('commandsAddCommand'), 'plus', () => this.openModal(null, 'command'));
    this.addHeaderButton(actionsEl, trReasonix('commandsAddSkill'), 'sparkles', () => this.openModal(null, 'skill'));
    this.addHeaderButton(actionsEl, trReasonix('commandsRefresh'), 'refresh-cw', () => {
      void this.render();
    });

    let entries: ProviderCommandEntry[];
    try {
      entries = await this.commandCatalog.listVaultEntries();
    } catch {
      const errorEl = this.containerEl.createDiv({ cls: 'claudian-mcp-empty' });
      errorEl.setText(trReasonix('commandsLoadFailed'));
      return;
    }

    if (entries.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'claudian-mcp-empty' });
      emptyEl.setText(trReasonix('commandsEmpty'));
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'claudian-mcp-list' });
    for (const entry of entries) {
      this.renderEntry(listEl, entry);
    }
  }

  private addHeaderButton(
    parentEl: HTMLElement,
    label: string,
    icon: string,
    onClick: () => void,
  ): void {
    const button = parentEl.createEl('button', {
      cls: 'claudian-settings-action-btn',
      attr: { 'aria-label': label, title: label },
    });
    setIcon(button, icon);
    button.addEventListener('click', onClick);
  }

  private renderEntry(parentEl: HTMLElement, entry: ProviderCommandEntry): void {
    const itemEl = parentEl.createDiv({ cls: 'claudian-mcp-item' });
    const infoEl = itemEl.createDiv({ cls: 'claudian-mcp-info' });
    const nameRow = infoEl.createDiv({ cls: 'claudian-mcp-name-row' });

    nameRow.createSpan({ cls: 'claudian-mcp-name', text: `/${entry.name}` });
    nameRow.createSpan({ cls: 'claudian-mcp-type-badge', text: entry.kind });

    const preview = entry.description || entry.persistenceKey || entry.content.split(/\n/).find(Boolean) || '';
    if (preview) {
      infoEl.createDiv({ cls: 'claudian-mcp-preview', text: preview });
    }

    const actionsEl = itemEl.createDiv({ cls: 'claudian-mcp-actions' });
    const editBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn',
      attr: { 'aria-label': trReasonix('actionEdit'), title: trReasonix('actionEdit') },
    });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => this.openModal(entry, entry.kind));

    const deleteBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn claudian-mcp-delete-btn',
      attr: { 'aria-label': trReasonix('actionDelete'), title: trReasonix('actionDelete') },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(trReasonix('deleteConfirm', { name: entry.name }))) {
        return;
      }

      try {
        await this.commandCatalog.deleteVaultEntry(entry);
        new Notice(trReasonix('noticeDeleted', { name: entry.name }));
        await this.render();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : trReasonix('noticeDeleteFailed'));
      }
    });
  }

  private openModal(entry: ProviderCommandEntry | null, kind: ProviderCommandKind): void {
    const modal = new ReasonixCommandEntryModal(
      this.app,
      entry,
      kind,
      async (nextEntry) => {
        await this.commandCatalog.saveVaultEntry(nextEntry);
        new Notice(trReasonix('noticeSaved', { name: nextEntry.name }));
        await this.render();
      },
    );
    modal.open();
  }
}
