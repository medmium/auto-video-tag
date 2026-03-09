import { Plugin, MarkdownView, TFile } from 'obsidian';

export default class VideoAttachmentPlugin extends Plugin {
	private isProcessing = false;
	private lastKnownContent: string = '';

	async onload() {
		console.log('Video Attachment Plugin loaded');

		// 监听编辑器内容变化
		this.registerEvent(
			this.app.workspace.on('editor-change', async (editor, view) => {
				if (!(view instanceof MarkdownView)) return;
				
				const currentContent = editor.getValue();
				const addedText = this.findAddedText(this.lastKnownContent, currentContent);
				this.lastKnownContent = currentContent;

				// 检查新增文本中是否有MP4链接
				if (addedText && this.containsMp4Link(addedText)) {
					await this.convertMp4LinksToVideoTags(editor);
				}
			})
		);

		// 监听拖拽事件
		this.registerEvent(
			this.app.workspace.on('editor-drop', async (event, editor, view) => {
				if (!(view instanceof MarkdownView)) return;
				
				event.preventDefault();
				
				// 延迟处理，等待文件操作完成
				setTimeout(async () => {
					await this.convertMp4LinksToVideoTags(editor);
				}, 300);
			})
		);

		// 监听粘贴事件
		this.registerEvent(
			this.app.workspace.on('editor-paste', async (clipboardEvent, editor, view) => {
				if (!(view instanceof MarkdownView)) return;
				
				// 延迟处理，等待粘贴操作完成
				setTimeout(async () => {
					await this.convertMp4LinksToVideoTags(editor);
				}, 100);
			})
		);

		// 监听文件创建事件（用于处理外部拖入的文件）
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (!(file instanceof TFile)) return;
				
				if (file.extension === 'mp4') {
					// 延迟处理，确保文件被完全写入
					setTimeout(async () => {
						const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (activeView && activeView.editor) {
							await this.convertMp4LinksToVideoTags(activeView.editor);
						}
					}, 500);
				}
			})
		);
	}

	onunload() {
		console.log('Video Attachment Plugin unloaded');
	}

	private findAddedText(oldText: string, newText: string): string {
		if (newText.length <= oldText.length) return '';
		
		// 寻找新增的部分
		const commonStart = this.getLongestCommonPrefix(oldText, newText);
		const addedPart = newText.substring(commonStart.length);
		
		return addedPart;
	}

	private getLongestCommonPrefix(str1: string, str2: string): string {
		let i = 0;
		while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
			i++;
		}
		return str1.substring(0, i);
	}

	private containsMp4Link(text: string): boolean {
		return /!\[([^\]]*)\]\([^)]*\.mp4\)/i.test(text) || 
			   /!\[\[.*\.mp4\]\]/i.test(text);
	}

	private async convertMp4LinksToVideoTags(editor: any) {
		if (this.isProcessing) return;
		
		const content = editor.getValue();
		let newContent = content;
		let updated = false;

		// 匹配标准Markdown图片语法: ![alt](path/to/video.mp4)
		const standardLinkRegex = /!\[([^\]]*)\]\(([^)]*\.mp4(?:\?[^\s)]*)?)\)/gi;
		let match;
		while ((match = standardLinkRegex.exec(content)) !== null) {
			const fullMatch = match[0];
			const altText = match[1];
			const videoSrc = match[2];
			
			// 检查是否已经是video标签
			if (!this.isAlreadyVideoTag(content, match.index)) {
				const videoTag = `<video src="${videoSrc}" controls>\n  您的浏览器不支持视频标签。\n</video>`;
				newContent = newContent.replace(fullMatch, videoTag);
				updated = true;
			}
		}

		// 匹配Obsidian内部链接语法: ![[video.mp4]]
		const internalLinkRegex = /!\[\[(.*?\.mp4)(?:\|(.*?))?\]\]/gi;
		while ((match = internalLinkRegex.exec(content)) !== null) {
			const fullMatch = match[0];
			const fileName = match[1];
			const displayName = match[2] || fileName;
			
			// 检查是否已经是video标签
			if (!this.isAlreadyVideoTag(content, match.index)) {
				const videoTag = `<video src="${fileName}" controls>\n  您的浏览器不支持视频标签。\n</video>`;
				newContent = newContent.replace(fullMatch, videoTag);
				updated = true;
			}
		}

		if (updated) {
			this.isProcessing = true;
			const cursorPos = editor.getCursor();
			editor.setValue(newContent);
			editor.setCursor(cursorPos); // 保持光标位置
			this.isProcessing = false;
		}
	}

	private isAlreadyVideoTag(content: string, index: number): boolean {
		// 向前查找，看是否已经在video标签内
		const beforeIndex = content.substring(0, index);
		const lastOpeningVideo = beforeIndex.lastIndexOf('<video');
		const lastClosingVideo = beforeIndex.lastIndexOf('</video>');
		
		// 如果最近的video开始标签比结束标签更近，则说明在video标签内
		return lastOpeningVideo > lastClosingVideo;
	}
}