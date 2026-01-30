game.import("extension", function (lib, game, ui, get, ai, _status) {
	window._xingyuxue_onEvent = async function (player, event) {
		console.log('[星与血智能] 检测到事件 - 角色:', player.name, '事件:', event.name);

		function getIntro(name) {
			if (!name || !lib.characterIntro) {
				return '未知角色';
			}
			const mainName = name.split(/[\/·]/)[0].trim();
			return lib.characterIntro[mainName] || '神秘角色';
		}

		const state = {
			name: player.name,
			nameTrans: get.translation(player.name),
			intro: getIntro(player.name),
			hp: player.hp,
			maxHp: player.maxHp,
			handcards: player.countCards('h'),
			identity: get.translation(player.identity) || player.identity || '未知',
			teammates: [],
			enemies: []
		};

		game.players.forEach(p => {
			if (p === player || p.isDead()) return;
			const att = get.attitude(player, p);
			const pName = get.translation(p.name);
			if (att > 0) state.teammates.push(pName);
			else state.enemies.push(pName);
		});

		let prompt = '';
		const teammatesStr = state.teammates.length ? state.teammates.join('、') : '暂无';
		const enemiesStr = state.enemies.length ? state.enemies.join('、') : '暂无';

		switch (event.name) {
			case 'die':
				const source = event.source && event.source !== player ? get.translation(event.source.name) : null;
				prompt = `我即是${state.nameTrans}（${state.identity}），${state.intro}。${source ? `死于${source}之手` : '孤身赴死'}，生命将尽。此刻，我文白相间地道出最后心声：`;
				break;
			default:
				prompt = `我即是${state.nameTrans}（${state.identity}），${state.intro}。身处三国杀牌局：体力${state.hp}/${state.maxHp}，手牌${state.handcards}张。队友：${teammatesStr}；敌人：${enemiesStr}。此刻，我文白相间地道出心声：`;
				break;
		}

		console.log(`[星与血智能] 发送请求到AI...【${prompt}】`);

		try {
			for (let attempt = 0; attempt < 3; attempt++) {
				const res = await fetch('http://127.0.0.1:5001/v1/completions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						prompt: prompt,
						max_tokens: 100,
						temperature: 0.7,
						stop: ['\n', '【', '】', '<', '[', ']', '：', ':', '。', '！', '？']
					})
				});

				if (!res.ok) {
					console.error('[星与血智能] AI请求失败:', res.status);
					continue;
				}

				const data = await res.json();
				let text = data.choices[0].text.trim();

				console.log('[星与血智能] AI原始回复:', JSON.stringify(text));

				text = text
					.replace(/^["'""'''""]/g, '')
					.trim();
				if (text.startsWith(state.nameTrans + '：') || text.startsWith(state.nameTrans + ':') ||
					text.startsWith(state.name + '：') || text.startsWith(state.name + ':')) {
					text = text.substring((state.nameTrans + '：').length);
				}
				text = text.split(/[\n。！？]/)[0];
				if (text) text = text.trim();
				//if (text.length > 40) text = text.substring(0, 38) + '…';

				console.log('[星与血智能] 清理后文本:', JSON.stringify(text));

				if (text && text.length >= 8) {
					player.chat(text);
					game.log('💬 <span class="bluetext">' + get.translation(player.name) + '</span>：' + text);
					console.log('[星与血智能] 成功发送chat:', text);
					return;
				}

				console.log('[星与血智能] 第', attempt + 1, '次尝试失败，重试...');
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			console.log('[星与血智能] 三次尝试均失败，跳过');

		} catch (e) {
			console.error('[星与血智能] 生成失败:', e.message || e);
		}
	};

	return {
		name: "星与血智能",
		content: function (config, pack) {
			console.log('[星与血智能] 扩展已启用');
		},
		help: {},
		config: {},
		package: {
			skill: {
				skill: {
					_xingyuxue_event_handler: {
						forced: true,
						forceDie: true,
						forceLoad: true,
						popup: false,
						silent: true,
						trigger: {
							player: ['phaseBegin', 'dieAfter']
						},
						content: function () {
							if (typeof window._xingyuxue_onEvent === 'function') {
								window._xingyuxue_onEvent(player, trigger);
							}
						}
					}
				},
				translate: {
					_xingyuxue_event_handler: "星与血智能",
					"_xingyuxue_event_handler_bg": "星与血"
				}
			},
			character: { character: {}, translate: {}, perfectPair: {} },
			card: { card: {}, translate: {}, list: [] },
			intro: "牌局实时AI对话与故事生成",
			author: "Zhucchero",
			version: "1.0"
		},
		files: { "character": [], "card": [], "skill": [], "audio": [] }
	};
});