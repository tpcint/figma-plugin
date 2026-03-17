// Likey Assistant - Figma Plugin

figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

// 저장된 탭 순서 → UI로 전송
(async function sendSavedPrefs() {
  try {
    var tabOrder = await figma.clientStorage.getAsync('tabOrder');
    if (tabOrder) {
      figma.ui.postMessage({ type: 'restore-tab-order', order: tabOrder });
    }
  } catch(e) {}
})();

// 현재 선택된 필드명 저장 (미리보기용)
let currentFieldName = null;

function updateSelectionInfo() {
  const selection = figma.currentPage.selection;

  // 현재 필드명이 설정되어 있으면 일치하는 레이어 개수도 계산
  let matchingCount = 0;
  if (currentFieldName) {
    for (const node of selection) {
      matchingCount += countMatchingLayersInNode(node, currentFieldName.toLowerCase());
    }
  }

  figma.ui.postMessage({
    type: 'selection-update',
    count: selection.length,
    names: selection.map(node => node.name).slice(0, 3),
    matchingCount: matchingCount
  });
}

// 일치하는 레이어 개수 세기
function countMatchingLayers(fieldName) {
  currentFieldName = fieldName;
  const selection = figma.currentPage.selection;

  let matchingCount = 0;
  for (const node of selection) {
    matchingCount += countMatchingLayersInNode(node, fieldName.toLowerCase());
  }

  figma.ui.postMessage({
    type: 'selection-update',
    count: selection.length,
    names: selection.map(node => node.name).slice(0, 3),
    matchingCount: matchingCount
  });
}

// 노드 내에서 필드명과 일치하는 레이어 개수 재귀적으로 세기
function countMatchingLayersInNode(node, fieldNameLower) {
  let count = 0;

  // 현재 노드의 이름이 필드명과 일치하는지 확인
  if (node.name.toLowerCase() === fieldNameLower) {
    count++;
  }

  // 자식 노드들도 재귀적으로 탐색
  if ('children' in node && node.children) {
    for (const child of node.children) {
      count += countMatchingLayersInNode(child, fieldNameLower);
    }
  }

  return count;
}

// 선택 변경 감지
figma.on('selectionchange', () => {
  updateSelectionInfo();
});

// 초기 선택 정보 전송
updateSelectionInfo();

// UI에서 메시지 수신
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'execute-command') {
    await executeCommand(msg.command);
  }

  if (msg.type === 'get-selection-info') {
    getSelectionInfo();
  }

  // 탭 순서 저장 (figma.clientStorage → 플러그인 재시작 후에도 유지)
  if (msg.type === 'save-tab-order') {
    try {
      await figma.clientStorage.setAsync('tabOrder', msg.order);
    } catch(e) {}
  }

  // 직접 텍스트 변경
  if (msg.type === 'direct-text-change') {
    await directTextChange(msg.text);
  }

  if (msg.type === 'spell-check') {
    await spellCheck();
  }

  if (msg.type === 'spell-check-response') {
    // UI에서 받은 맞춤법 검사 결과 처리
    figma.ui.postMessage({
      type: 'spell-results',
      errors: msg.errors
    });
  }

  // 레이어 네이밍 기능
  if (msg.type === 'load-layers') {
    loadSelectedLayers();
  }

  if (msg.type === 'rename-layers') {
    renameLayers(msg.changes);
  }

  // 선택된 레이어 이름 변경 (Selected Change)
  if (msg.type === 'rename-selected') {
    renameSelectedLayers(msg.namingType);
  }

  // 자동 네이밍 (Auto Rename)
  if (msg.type === 'auto-rename') {
    autoRenameAllLayers();
  }

  // UI 리사이즈
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }

  // 더미 데이터 적용
  if (msg.type === 'apply-dummy-data') {
    applyDummyData(msg.value);
  }

  // 랜덤 채우기
  if (msg.type === 'random-fill') {
    await randomFillData(msg.category, msg.data, msg.avatarImageData);
  }

  // 이미지 채우기
  if (msg.type === 'apply-image-fill') {
    applyImageFill(msg.imageType);
  }

  // 일치하는 레이어 개수 세기
  if (msg.type === 'count-matching-layers') {
    countMatchingLayers(msg.fieldName);
  }

  // 디자인 시스템 체커
  if (msg.type === 'scan-design-system') {
    scanDesignSystem(msg.checkerType);
  }

  // 특정 노드 선택
  if (msg.type === 'select-node') {
    selectNodeById(msg.nodeId);
  }

  // 여러 노드 선택
  if (msg.type === 'select-multiple-nodes') {
    selectMultipleNodes(msg.nodeIds);
  }

  // 코드에서 디자인 생성
  if (msg.type === 'generate-from-code') {
    await generateDesignFromCode(msg.codeType, msg.parsed, msg.rawCode);
  }

  // Tailwind → Gemini 결과로 디자인 생성
  if (msg.type === 'generate-from-tailwind') {
    await createDesignFromGeminiResponse(msg.geminiResult);
  }

  // 베리어블 생성
  if (msg.type === 'create-variables') {
    await createVariablesFromTokens(msg.collectionName, msg.tokens);
  }

  // 텍스트 스타일 생성
  if (msg.type === 'create-text-styles') {
    await createTextStylesFromTokens(msg.tokens);
  }

  // 베리어블 컬렉션 목록 조회
  if (msg.type === 'get-variable-collections') {
    try {
      var cols = figma.variables.getLocalVariableCollections()
        .map(function(c) { return { name: c.name }; });
      figma.ui.postMessage({ type: 'variable-collections', collections: cols });
    } catch(e) {
      figma.ui.postMessage({ type: 'variable-collections', collections: [] });
    }
  }

  // 테이블 토큰 → Light/Dark 모드 베리어블 생성
  if (msg.type === 'create-table-variables') {
    await createTableVariables(msg.collectionName, msg.tokens);
  }

  // .pen 프레임 변환
  if (msg.type === 'convert-pen-frames') {
    await convertPenFrames(msg.frames, msg.variables);
  }

  // AI 디자인 생성
  if (msg.type === 'ai-generate') {
    await executeAICommands(msg.commands);
  }
};

// 선택된 레이어 정보 가져오기
function getSelectionInfo() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'selection-info',
      info: '선택된 레이어가 없습니다.'
    });
    return;
  }

  const infos = selection.map(node => {
    let info = `[${node.type}] ${node.name}\n`;
    info += `  - ID: ${node.id}\n`;
    info += `  - 위치: (${Math.round(node.x)}, ${Math.round(node.y)})\n`;
    info += `  - 크기: ${Math.round(node.width)} x ${Math.round(node.height)}\n`;

    if (node.type === 'TEXT') {
      info += `  - 텍스트: "${node.characters}"\n`;
      info += `  - 폰트 크기: ${node.fontSize}\n`;
    }

    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        const color = fill.color;
        const hex = rgbToHex(color.r, color.g, color.b);
        info += `  - 배경색: ${hex}\n`;
      }
    }

    if ('opacity' in node) {
      info += `  - 투명도: ${Math.round(node.opacity * 100)}%\n`;
    }

    return info;
  });

  figma.ui.postMessage({
    type: 'selection-info',
    info: infos.join('\n')
  });
}

// 명령어 실행
async function executeCommand(command) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  try {
    // 명령어 파싱 및 실행
    const result = await parseAndExecute(command, selection);

    figma.ui.postMessage({
      type: 'status',
      status: 'success',
      message: result
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: `오류: ${error.message}`
    });
  }
}

// 명령어 파싱 및 실행
async function parseAndExecute(command, selection) {
  const cmd = command.toLowerCase();

  // 텍스트 찾아서 변경: "기존텍스트>새텍스트" 형식
  // 예: "팔로워(전체)>전체 메시지"
  if (command.includes('>') && !command.startsWith('>')) {
    const parts = command.split('>');
    if (parts.length === 2) {
      const searchText = parts[0].trim();
      const newText = parts[1].trim();

      let changed = 0;

      for (const node of selection) {
        // 선택된 노드 내의 모든 텍스트에서 검색 (컴포넌트, 인스턴스, 오토레이아웃 포함)
        const textNodes = findTextNodeByContent(node, searchText);

        for (const textNode of textNodes) {
          const success = await replaceTextInNode(textNode, searchText, newText);
          if (success) changed++;
        }
      }

      if (changed === 0) {
        throw new Error(`"${searchText}" 텍스트를 찾을 수 없습니다.`);
      }

      return `"${searchText}"를 "${newText}"로 ${changed}개 변경했습니다.`;
    }
  }

  // 프레임 내 모든 텍스트 변경: ">새텍스트" 형식
  if (command.startsWith('>')) {
    const newText = command.slice(1).trim();
    let changed = 0;

    for (const node of selection) {
      // 프레임/그룹/컴포넌트/인스턴스 내부 텍스트 모두 찾기
      const textNodes = findAllTextNodes(node);

      for (const textNode of textNodes) {
        const success = await changeTextInNode(textNode, newText);
        if (success) changed++;
      }
    }

    if (changed === 0) {
      throw new Error('선택된 영역에 텍스트가 없습니다.');
    }

    return `${changed}개의 텍스트를 "${newText}"로 변경했습니다.`;
  }

  // 텍스트 변경 - 기존 방식도 지원
  const textMatch = command.match(/['"'"](.+?)['"'"]/);
  if ((cmd.includes('텍스트') && cmd.includes('변경')) || cmd.includes('text')) {
    let newText;

    if (textMatch) {
      newText = textMatch[1];
    } else {
      throw new Error("변경할 텍스트를 입력해주세요.\n예: 팔로워(전체)>전체 메시지");
    }

    let changed = 0;

    for (const node of selection) {
      const textNodes = findAllTextNodes(node);

      for (const textNode of textNodes) {
        const success = await changeTextInNode(textNode, newText);
        if (success) changed++;
      }
    }

    if (changed === 0) {
      throw new Error('선택된 영역에 텍스트가 없습니다.');
    }

    return `${changed}개의 텍스트를 "${newText}"로 변경했습니다.`;
  }

  // 색상 변경
  const colorMatch = command.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/);
  if ((cmd.includes('색') && cmd.includes('변경')) || cmd.includes('color')) {
    if (!colorMatch) {
      throw new Error('색상을 HEX 코드로 입력해주세요. 예: #FF5733');
    }

    const hex = colorMatch[0];
    const rgb = hexToRgb(hex);
    let changed = 0;

    for (const node of selection) {
      if ('fills' in node) {
        const fills = JSON.parse(JSON.stringify(node.fills));
        if (fills.length > 0 && fills[0].type === 'SOLID') {
          fills[0].color = rgb;
          node.fills = fills;
          changed++;
        } else {
          node.fills = [{ type: 'SOLID', color: rgb }];
          changed++;
        }
      }
    }

    if (changed === 0) {
      throw new Error('색상을 변경할 수 없는 레이어입니다.');
    }

    return `${changed}개의 레이어 색상을 ${hex}로 변경했습니다.`;
  }

  // 크기 변경 (너비)
  const widthMatch = cmd.match(/너비[를을]?\s*(\d+)/);
  if (widthMatch) {
    const newWidth = parseInt(widthMatch[1]);

    for (const node of selection) {
      if ('resize' in node) {
        node.resize(newWidth, node.height);
      }
    }

    return `너비를 ${newWidth}px로 변경했습니다.`;
  }

  // 크기 변경 (높이)
  const heightMatch = cmd.match(/높이[를을]?\s*(\d+)/);
  if (heightMatch) {
    const newHeight = parseInt(heightMatch[1]);

    for (const node of selection) {
      if ('resize' in node) {
        node.resize(node.width, newHeight);
      }
    }

    return `높이를 ${newHeight}px로 변경했습니다.`;
  }

  // 투명도 변경
  const opacityMatch = cmd.match(/(\d+)\s*%/);
  if (cmd.includes('투명도') && opacityMatch) {
    const opacity = parseInt(opacityMatch[1]) / 100;

    for (const node of selection) {
      if ('opacity' in node) {
        node.opacity = Math.max(0, Math.min(1, opacity));
      }
    }

    return `투명도를 ${opacityMatch[1]}%로 변경했습니다.`;
  }

  // 레이어 복제
  if (cmd.includes('복제') || cmd.includes('복사') || cmd.includes('duplicate')) {
    const newNodes = [];

    for (const node of selection) {
      const clone = node.clone();
      clone.x += 20;
      clone.y += 20;
      newNodes.push(clone);
    }

    figma.currentPage.selection = newNodes;
    return `${selection.length}개의 레이어를 복제했습니다.`;
  }

  // 레이어 삭제
  if (cmd.includes('삭제') || cmd.includes('delete') || cmd.includes('remove')) {
    const count = selection.length;

    for (const node of selection) {
      node.remove();
    }

    return `${count}개의 레이어를 삭제했습니다.`;
  }

  // 폰트 크기 변경
  const fontSizeMatch = cmd.match(/폰트\s*(?:크기)?[를을]?\s*(\d+)/);
  if (fontSizeMatch || (cmd.includes('font') && cmd.includes('size'))) {
    const sizeMatch = command.match(/(\d+)/);
    if (!sizeMatch) {
      throw new Error('폰트 크기를 숫자로 입력해주세요.');
    }

    const newSize = parseInt(sizeMatch[1]);
    let changed = 0;

    for (const node of selection) {
      if (node.type === 'TEXT') {
        await figma.loadFontAsync(node.fontName);
        node.fontSize = newSize;
        changed++;
      }
    }

    if (changed === 0) {
      throw new Error('선택된 레이어 중 텍스트가 없습니다.');
    }

    return `폰트 크기를 ${newSize}px로 변경했습니다.`;
  }

  // 이동
  const moveMatch = cmd.match(/[이동|움직|move].*?[(\(]?\s*(-?\d+)\s*,\s*(-?\d+)\s*[)\)]?/);
  if (moveMatch) {
    const dx = parseInt(moveMatch[1]);
    const dy = parseInt(moveMatch[2]);

    for (const node of selection) {
      node.x += dx;
      node.y += dy;
    }

    return `레이어를 (${dx}, ${dy})만큼 이동했습니다.`;
  }

  // 숨기기
  if (cmd.includes('숨기') || cmd.includes('hide')) {
    for (const node of selection) {
      node.visible = false;
    }

    return `${selection.length}개의 레이어를 숨겼습니다.`;
  }

  // 보이기
  if (cmd.includes('보이') || cmd.includes('show') || cmd.includes('표시')) {
    for (const node of selection) {
      node.visible = true;
    }

    return `${selection.length}개의 레이어를 표시했습니다.`;
  }

  // 이름 변경
  const nameMatch = command.match(/이름[을를]?\s*['"'"](.+?)['"'"]/);
  if (nameMatch) {
    const newName = nameMatch[1];

    for (const node of selection) {
      node.name = newName;
    }

    return `레이어 이름을 "${newName}"으로 변경했습니다.`;
  }

  // 모서리 둥글기
  const radiusMatch = cmd.match(/(?:모서리|라운드|radius|corner)[를을]?\s*(\d+)/);
  if (radiusMatch) {
    const radius = parseInt(radiusMatch[1]);

    for (const node of selection) {
      if ('cornerRadius' in node) {
        node.cornerRadius = radius;
      }
    }

    return `모서리 둥글기를 ${radius}px로 변경했습니다.`;
  }

  throw new Error(`명령어를 이해하지 못했습니다: "${command}"\n예시 명령어를 참고해주세요.`);
}

// 유틸리티 함수들
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16) / 255,
        g: parseInt(shortResult[2] + shortResult[2], 16) / 255,
        b: parseInt(shortResult[3] + shortResult[3], 16) / 255
      };
    }
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  };
}

function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// 노드 내부의 모든 텍스트 노드 찾기 (재귀)
// 컴포넌트, 인스턴스, 오토레이아웃 모두 지원
function findAllTextNodes(node) {
  const textNodes = [];

  // 텍스트 노드인 경우
  if (node.type === 'TEXT') {
    textNodes.push(node);
    return textNodes;
  }

  // 자식이 있는 모든 노드 타입 처리
  // FRAME, GROUP, COMPONENT, COMPONENT_SET, INSTANCE, SECTION, PAGE 등
  if ('children' in node && node.children) {
    for (const child of node.children) {
      textNodes.push(...findAllTextNodes(child));
    }
  }

  return textNodes;
}

// 특정 텍스트를 포함하는 텍스트 노드 찾기
function findTextNodeByContent(node, searchText) {
  const allTextNodes = findAllTextNodes(node);
  return allTextNodes.filter(textNode =>
    textNode.characters.includes(searchText)
  );
}

// 인스턴스 내 텍스트 변경을 위한 헬퍼 함수
async function changeTextInNode(textNode, newText) {
  try {
    // Mixed fonts 처리
    if (textNode.fontName === figma.mixed) {
      // 모든 문자의 폰트를 로드
      const len = textNode.characters.length;
      for (let i = 0; i < len; i++) {
        const font = textNode.getRangeFontName(i, i + 1);
        await figma.loadFontAsync(font);
      }
    } else {
      await figma.loadFontAsync(textNode.fontName);
    }
    textNode.characters = newText;
    return true;
  } catch (e) {
    console.error('Font load error:', e);
    return false;
  }
}

// 텍스트 부분 교체를 위한 헬퍼 함수
async function replaceTextInNode(textNode, searchText, newText) {
  try {
    // Mixed fonts 처리
    if (textNode.fontName === figma.mixed) {
      const len = textNode.characters.length;
      for (let i = 0; i < len; i++) {
        const font = textNode.getRangeFontName(i, i + 1);
        await figma.loadFontAsync(font);
      }
    } else {
      await figma.loadFontAsync(textNode.fontName);
    }
    textNode.characters = textNode.characters.replace(searchText, newText);
    return true;
  } catch (e) {
    console.error('Font load error:', e);
    return false;
  }
}

// 선택된 레이어 불러오기 (네이밍용)
function loadSelectedLayers() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'naming-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  // 선택된 레이어와 하위 레이어 수집
  const layers = [];

  function collectLayers(node, depth = 0) {
    // 최대 깊이 제한 (너무 깊은 중첩 방지)
    if (depth > 10) return;

    layers.push({
      id: node.id,
      name: node.name,
      type: getShortType(node.type)
    });

    // 하위 레이어도 수집 (옵션)
    if ('children' in node && node.children && depth === 0) {
      // 첫 번째 레벨의 자식만 수집
      for (const child of node.children) {
        layers.push({
          id: child.id,
          name: child.name,
          type: getShortType(child.type)
        });
      }
    }
  }

  for (const node of selection) {
    collectLayers(node);
  }

  figma.ui.postMessage({
    type: 'layers-loaded',
    layers: layers
  });
}

// 레이어 타입 축약
function getShortType(type) {
  const typeMap = {
    'FRAME': 'Frame',
    'GROUP': 'Group',
    'TEXT': 'Text',
    'RECTANGLE': 'Rect',
    'ELLIPSE': 'Ellipse',
    'VECTOR': 'Vector',
    'COMPONENT': 'Comp',
    'INSTANCE': 'Inst',
    'COMPONENT_SET': 'Set',
    'LINE': 'Line',
    'POLYGON': 'Poly',
    'STAR': 'Star',
    'BOOLEAN_OPERATION': 'Bool',
    'SLICE': 'Slice',
    'SECTION': 'Sect'
  };
  return typeMap[type] || type;
}

// 레이어 이름 변경
function renameLayers(changes) {
  let renamed = 0;

  for (const change of changes) {
    const node = figma.getNodeById(change.id);
    if (node) {
      node.name = change.name;
      renamed++;
    }
  }

  figma.ui.postMessage({
    type: 'naming-status',
    status: 'success',
    message: `${renamed}개의 레이어 이름을 변경했습니다.`
  });
}

// 선택된 레이어 이름 변경 (Selected Change)
function renameSelectedLayers(namingType) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'rename-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  let renamed = 0;

  function renameRecursive(node) {
    // Component, Instance는 변경하지 않음
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') {
      return;
    }

    node.name = namingType;
    renamed++;

    // 자식 노드도 재귀적으로 처리
    if ('children' in node && node.children) {
      for (const child of node.children) {
        renameRecursive(child);
      }
    }
  }

  for (const node of selection) {
    renameRecursive(node);
  }

  figma.ui.postMessage({
    type: 'rename-status',
    status: 'success',
    message: `${renamed}개의 레이어 이름을 "${namingType}"으로 변경했습니다.`
  });
}

// 자동 네이밍 (Auto Rename) - Naming Guide 규칙 적용
function autoRenameAllLayers() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'rename-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  let renamed = 0;

  function getAutoName(node, parentIsAutoLayout = false) {
    // Component, Instance는 변경하지 않음
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') {
      return null;
    }

    // TEXT -> "Text"
    if (node.type === 'TEXT') {
      return 'Text';
    }

    // Image Fill 체크 -> "Image"
    if ('fills' in node && Array.isArray(node.fills)) {
      const hasImageFill = node.fills.some(fill => fill.type === 'IMAGE');
      if (hasImageFill) {
        return 'Image';
      }
    }

    // FRAME/GROUP 처리
    if (node.type === 'FRAME' || node.type === 'GROUP') {
      // Auto Layout 체크
      const isAutoLayout = 'layoutMode' in node && node.layoutMode !== 'NONE';

      if (isAutoLayout) {
        // All Auto Layouts -> "Section"
        return 'Section';
      } else if (parentIsAutoLayout) {
        // FRAME/GROUP Inside Auto Layout -> "Item"
        return 'Item';
      } else {
        // Frame/Group (Not Auto Layout) -> "Content"
        return 'Content';
      }
    }

    // 기타 도형들
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' ||
        node.type === 'POLYGON' || node.type === 'STAR' ||
        node.type === 'LINE' || node.type === 'VECTOR') {
      // Image Fill 체크
      if ('fills' in node && Array.isArray(node.fills)) {
        const hasImageFill = node.fills.some(fill => fill.type === 'IMAGE');
        if (hasImageFill) {
          return 'Image';
        }
      }
      return 'Item';
    }

    return null;
  }

  function renameRecursive(node, parentIsAutoLayout = false) {
    const newName = getAutoName(node, parentIsAutoLayout);

    if (newName) {
      node.name = newName;
      renamed++;
    }

    // 현재 노드가 Auto Layout인지 확인
    const isAutoLayout = 'layoutMode' in node && node.layoutMode !== 'NONE';

    // 자식 노드 처리
    if ('children' in node && node.children) {
      for (const child of node.children) {
        // Component/Instance 내부는 처리하지 않음
        if (node.type !== 'COMPONENT' && node.type !== 'INSTANCE' && node.type !== 'COMPONENT_SET') {
          renameRecursive(child, isAutoLayout);
        }
      }
    }
  }

  for (const node of selection) {
    renameRecursive(node, false);
  }

  figma.ui.postMessage({
    type: 'rename-status',
    status: 'success',
    message: `${renamed}개의 레이어를 자동으로 네이밍했습니다.`
  });
}

// 직접 텍스트 변경 함수
async function directTextChange(newText) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  let changed = 0;

  for (const node of selection) {
    const textNodes = findAllTextNodes(node);

    for (const textNode of textNodes) {
      const success = await changeTextInNode(textNode, newText);
      if (success) changed++;
    }
  }

  if (changed === 0) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: '선택된 영역에 텍스트가 없습니다.'
    });
    return;
  }

  figma.ui.postMessage({
    type: 'status',
    status: 'success',
    message: `${changed}개의 텍스트를 변경했습니다.`
  });
}

// 맞춤법 검사 함수
async function spellCheck() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  // 선택된 영역의 모든 텍스트 수집
  const allTexts = [];
  for (const node of selection) {
    const textNodes = findAllTextNodes(node);
    for (const textNode of textNodes) {
      if (textNode.characters.trim()) {
        allTexts.push(textNode.characters);
      }
    }
  }

  if (allTexts.length === 0) {
    figma.ui.postMessage({
      type: 'status',
      status: 'error',
      message: '검사할 텍스트가 없습니다.'
    });
    return;
  }

  // UI에 텍스트 전달하여 맞춤법 검사 요청
  figma.ui.postMessage({
    type: 'check-spelling',
    texts: allTexts
  });
}

// 더미 데이터 적용
async function applyDummyData(value) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  let changed = 0;

  for (const node of selection) {
    const textNodes = findAllTextNodes(node);

    for (const textNode of textNodes) {
      const success = await changeTextInNode(textNode, value);
      if (success) changed++;
    }
  }

  if (changed === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '선택된 영역에 텍스트가 없습니다.'
    });
    return;
  }

  figma.ui.postMessage({
    type: 'data-fill-status',
    status: 'success',
    message: `${changed}개의 텍스트에 데이터를 적용했습니다.`
  });
}

// 순서대로 채우기 - 레이어 이름과 데이터 필드 이름이 일치하는 경우에만 적용
// Avatar 디버그 로그 수집
var _avatarDebugLog = [];
// ui.html에서 프리페치한 Avatar 이미지 데이터 (index → Uint8Array bytes)
var _avatarImageData = {};

async function randomFillData(category, data, avatarImageData) {
  _avatarDebugLog = [];
  _avatarImageData = avatarImageData || {};
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  // 데이터 필드 이름 목록 생성 (대소문자 무시 비교를 위해)
  // 각 필드별로 현재 인덱스를 관리하여 순서대로 데이터 적용
  const fieldMap = {};
  for (const field of data) {
    fieldMap[field.name.toLowerCase()] = {
      name: field.name,
      desc: field.desc,
      values: field.values,
      isImage: field.isImage || false,
      imageType: field.imageType || null,
      currentIndex: 0  // 순서대로 적용을 위한 인덱스
    };
  }

  // Avatar 필드 확인
  const avatarField = fieldMap['avatar'];
  if (avatarField) {
    _avatarDebugLog.push(`fieldMap에 avatar 있음 (isImage=${avatarField.isImage}, values=${avatarField.values ? avatarField.values.length : 0}개)`);
  } else {
    _avatarDebugLog.push('fieldMap에 avatar 없음!');
  }
  _avatarDebugLog.push(`fieldMap 키: ${Object.keys(fieldMap).join(', ')}`);

  let changed = 0;
  let matched = 0;

  for (const node of selection) {
    // 선택된 노드와 모든 하위 노드 탐색
    const result = await fillMatchingLayersSequential(node, fieldMap);
    changed += result.changed;
    matched += result.matched;
  }

  if (matched === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '일치하는 레이어 이름이 없습니다. 레이어 이름을 데이터 필드명(예: CreatorName, FollowersText)과 동일하게 설정해주세요.'
    });
    return;
  }

  const avatarInfo = _avatarDebugLog.length > 0 ? '\n[Avatar] ' + _avatarDebugLog.join(' → ') : '';

  if (changed === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: `매칭된 레이어(${matched}개)에 적용할 데이터가 없습니다.${avatarInfo}`
    });
    return;
  }

  figma.ui.postMessage({
    type: 'data-fill-status',
    status: 'success',
    message: `${matched}개의 일치 레이어에서 ${changed}개에 적용 완료.${avatarInfo}`
  });
}

// 레이어 이름과 데이터 필드 이름이 일치하는 경우에만 순서대로 데이터 적용
async function fillMatchingLayersSequential(node, fieldMap) {
  let changed = 0;
  let matched = 0;

  // 현재 노드의 이름이 필드명과 일치하는지 확인
  const nodeName = node.name.toLowerCase();
  const matchingField = fieldMap[nodeName];

  if (matchingField) {
    matched++;
    const currentIdx = matchingField.currentIndex;
    matchingField.currentIndex++;

    if (matchingField.isImage) {
      _avatarDebugLog.push(`매칭:${node.name}(${node.type})`);

      // ui.html에서 프리페치한 이미지 데이터 사용
      const imageBytes = _avatarImageData[String(currentIdx)] || _avatarImageData[currentIdx];
      _avatarDebugLog.push(`프리페치 idx=${currentIdx}, 데이터=${imageBytes ? imageBytes.length + 'bytes' : '없음'}`);

      if (!imageBytes || imageBytes.length === 0) {
        _avatarDebugLog.push('프리페치 데이터 없음, 스킵');
      } else {
        // 타겟 노드 찾기
        const targetNode = findImageTargetNode(node);
        if (!targetNode) {
          _avatarDebugLog.push('타겟노드 없음!');
        } else {
          _avatarDebugLog.push(`타겟:${targetNode.name}(${targetNode.type})`);

          try {
            const imageData = new Uint8Array(imageBytes);
            const image = figma.createImage(imageData);
            const currentFills = targetNode.fills;
            if (currentFills === figma.mixed) {
              _avatarDebugLog.push('fills=mixed');
            } else {
              const fillsCopy = JSON.parse(JSON.stringify(currentFills || []));
              const hasImageFill = fillsCopy.some(f => f.type === 'IMAGE');
              if (hasImageFill) {
                targetNode.fills = fillsCopy.map(f =>
                  f.type === 'IMAGE' ? { type: 'IMAGE', imageHash: image.hash, scaleMode: f.scaleMode || 'FILL', visible: f.visible !== false, opacity: f.opacity !== undefined ? f.opacity : 1 } : f
                );
              } else {
                targetNode.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
              }
              changed++;
              _avatarDebugLog.push('적용완료!');
            }
          } catch (e) {
            _avatarDebugLog.push(`오류:${e.message}`);
          }
        }
      }
    } else if (matchingField.values && matchingField.values.length > 0) {
      // 텍스트 필드
      const value = matchingField.values[currentIdx % matchingField.values.length];

      // 이 노드가 텍스트이면 직접 변경
      if (node.type === 'TEXT') {
        const success = await changeTextInNode(node, value);
        if (success) changed++;
      } else {
        // 이 노드 내부의 모든 텍스트 노드 찾아서 변경 (같은 값으로)
        const textNodes = findAllTextNodes(node);
        for (const textNode of textNodes) {
          const success = await changeTextInNode(textNode, value);
          if (success) changed++;
        }
      }
    }
  }

  // 자식 노드들도 재귀적으로 탐색
  if ('children' in node && node.children) {
    for (const child of node.children) {
      const result = await fillMatchingLayersSequential(child, fieldMap);
      changed += result.changed;
      matched += result.matched;
    }
  }

  return { changed, matched };
}

// 이미지 채우기 기능
async function applyImageFill(imageType) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  // 이미지 Fill을 적용할 수 있는 노드들 찾기
  const fillableNodes = findFillableNodes(selection);

  if (fillableNodes.length === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '이미지를 적용할 수 있는 레이어가 없습니다. (Frame, Rectangle, Ellipse 등)'
    });
    return;
  }

  let changed = 0;

  for (const node of fillableNodes) {
    try {
      console.log(`Processing node: ${node.name} (${node.type})`);
      const imageUrl = getImageUrl(imageType, node.width, node.height);
      console.log(`Fetching image from: ${imageUrl}`);
      const imageData = await fetchImageData(imageUrl);

      if (imageData) {
        console.log(`Image data received, size: ${imageData.length}`);
        const image = figma.createImage(imageData);
        console.log(`Image created with hash: ${image.hash}`);

        // 기존 fills 복사하여 이미지만 교체
        try {
          // fills 읽기 가능한지 체크
          const currentFills = node.fills;
          console.log(`Current fills type: ${typeof currentFills}, isArray: ${Array.isArray(currentFills)}`);

          if (currentFills === figma.mixed) {
            console.log('Fills is mixed, skipping...');
            continue;
          }

          const fillsCopy = JSON.parse(JSON.stringify(currentFills || []));
          let newFills = [];

          // 기존에 이미지 Fill이 있으면 그것만 교체
          let hasExistingImage = false;
          for (const fill of fillsCopy) {
            if (fill.type === 'IMAGE') {
              hasExistingImage = true;
              newFills.push({
                type: 'IMAGE',
                imageHash: image.hash,
                scaleMode: fill.scaleMode || 'FILL',
                visible: fill.visible !== false,
                opacity: fill.opacity !== undefined ? fill.opacity : 1
              });
            } else {
              newFills.push(fill);
            }
          }

          // 기존 이미지가 없으면 새로 추가
          if (!hasExistingImage) {
            newFills = [{
              type: 'IMAGE',
              imageHash: image.hash,
              scaleMode: 'FILL'
            }];
          }

          console.log(`Setting new fills:`, JSON.stringify(newFills));
          node.fills = newFills;
          console.log(`Successfully applied to: ${node.name}`);
          changed++;
        } catch (fillError) {
          console.error('Cannot override fills:', fillError.message, node.name, node.type);

          // 대안: 직접 fills 배열 생성 시도
          try {
            console.log('Trying alternative method...');
            node.fills = [{
              type: 'IMAGE',
              imageHash: image.hash,
              scaleMode: 'FILL'
            }];
            console.log('Alternative method succeeded!');
            changed++;
          } catch (altError) {
            console.error('Alternative method also failed:', altError.message);
          }
        }
      } else {
        console.log('Failed to fetch image data');
      }
    } catch (e) {
      console.error('Image fill error:', e.message);
    }
  }

  if (changed === 0) {
    figma.ui.postMessage({
      type: 'data-fill-status',
      status: 'error',
      message: '이미지를 적용하는데 실패했습니다.'
    });
    return;
  }

  figma.ui.postMessage({
    type: 'data-fill-status',
    status: 'success',
    message: `${changed}개의 레이어에 이미지를 적용했습니다.`
  });
}

// 이미지 Fill을 적용할 수 있는 노드 찾기
function findFillableNodes(selection) {
  const fillableNodes = [];

  function collectFillable(node, depth = 0) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}[${node.type}] ${node.name}`);

    // 레이어 이름에 avatar, profile, image 등이 포함된 경우 우선 체크
    const nameLower = node.name.toLowerCase();
    const isLikelyImageLayer = nameLower.includes('avatar') ||
                               nameLower.includes('profile') ||
                               nameLower.includes('image') ||
                               nameLower.includes('photo') ||
                               nameLower.includes('thumbnail') ||
                               nameLower.includes('img');

    // fills 속성 체크
    if ('fills' in node) {
      try {
        const fills = node.fills;
        console.log(`${indent}  fills type: ${typeof fills}, isArray: ${Array.isArray(fills)}, length: ${Array.isArray(fills) ? fills.length : 'N/A'}`);

        if (fills !== figma.mixed && Array.isArray(fills)) {
          // fills 내용 상세 로그
          fills.forEach((fill, idx) => {
            console.log(`${indent}    fill[${idx}]: type=${fill.type}, visible=${fill.visible}`);
          });

          const hasImageFill = fills.some(fill => fill.type === 'IMAGE');

          if (hasImageFill) {
            console.log(`${indent}  ✓ Added (has IMAGE fill)`);
            fillableNodes.push(node);
            return;
          }

          // 이미지 이름을 가진 레이어이고 Shape인 경우
          if (isLikelyImageLayer && (
              node.type === 'RECTANGLE' ||
              node.type === 'ELLIPSE' ||
              node.type === 'FRAME' ||
              node.type === 'POLYGON' ||
              node.type === 'VECTOR')) {
            console.log(`${indent}  ✓ Added (likely image layer by name)`);
            fillableNodes.push(node);
            return;
          }
        }
      } catch (e) {
        console.log(`${indent}  fills error: ${e.message}`);
      }
    }

    // Shape 노드는 무조건 추가 (이미지 적용 가능)
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
      console.log(`${indent}  ✓ Added (shape: ${node.type})`);
      fillableNodes.push(node);
      // Shape도 children이 있을 수 있으므로 return하지 않음
    }

    // 자식 노드 탐색
    if ('children' in node && node.children && node.children.length > 0) {
      console.log(`${indent}  -> Exploring ${node.children.length} children`);
      for (const child of node.children) {
        collectFillable(child, depth + 1);
      }
    }
  }

  console.log('=== Finding fillable nodes ===');
  for (const node of selection) {
    collectFillable(node, 0);
  }

  console.log('=== Found nodes ===');
  fillableNodes.forEach(n => console.log(`  - ${n.name} (${n.type})`));
  return fillableNodes;
}

// 이미지 URL을 pen-server 프록시 경유로 변환 (Google Drive 등)
function convertImageUrl(url) {
  if (!url) return null;
  // Google Drive URL이면 로컬 프록시 경유 (CORS/리다이렉트 문제 회피)
  if (url.includes('drive.google.com')) {
    return `http://localhost:7777/proxy-image?url=${encodeURIComponent(url)}`;
  }
  // http(s)://로 시작하는 일반 URL은 그대로 사용
  if (url.match(/^https?:\/\//)) {
    return url;
  }
  // URL이 아닌 값 (파일명 등)은 null 반환 → 폴백 사용
  console.log(`[Avatar] URL 아닌 값 무시: ${url}`);
  return null;
}

// Avatar용: IMAGE fill 노드를 우선 탐색, 없으면 첫 번째 ELLIPSE/RECTANGLE 반환
function findImageTargetNode(node) {
  // 1순위: IMAGE fill이 있는 노드 탐색 (깊이 우선)
  function findByImageFill(n) {
    if ('fills' in n) {
      try {
        const fills = n.fills;
        if (fills !== figma.mixed && Array.isArray(fills) && fills.some(f => f.type === 'IMAGE')) {
          return n;
        }
      } catch (e) {}
    }
    if ('children' in n && n.children) {
      for (const child of n.children) {
        const found = findByImageFill(child);
        if (found) return found;
      }
    }
    return null;
  }

  // 2순위: 첫 번째 ELLIPSE 또는 RECTANGLE 탐색
  function findFirstShape(n) {
    if (n.type === 'ELLIPSE' || n.type === 'RECTANGLE') return n;
    if ('children' in n && n.children) {
      for (const child of n.children) {
        const found = findFirstShape(child);
        if (found) return found;
      }
    }
    return null;
  }

  return findByImageFill(node) || findFirstShape(node) || node;
}

// 프로필 이미지 URL 목록 (커스텀 이미지)
const PROFILE_IMAGES = [
  'https://i.pravatar.cc/300?img=1',
  'https://i.pravatar.cc/300?img=5',
  'https://i.pravatar.cc/300?img=9',
  'https://i.pravatar.cc/300?img=16',
  'https://i.pravatar.cc/300?img=20',
  'https://i.pravatar.cc/300?img=25',
  'https://i.pravatar.cc/300?img=32',
  'https://i.pravatar.cc/300?img=36',
  'https://i.pravatar.cc/300?img=41',
  'https://i.pravatar.cc/300?img=47'
];

// 이미지 타입에 따른 URL 생성
function getImageUrl(imageType, width, height) {
  // 기본 크기 설정 (최소 100px)
  const w = Math.max(100, Math.round(width));
  const h = Math.max(100, Math.round(height));

  // 랜덤 시드 생성
  const seed = Math.floor(Math.random() * 1000);

  switch (imageType) {
    case 'profile':
      // 커스텀 프로필 이미지 중 랜덤 선택
      const randomIdx = Math.floor(Math.random() * PROFILE_IMAGES.length);
      return PROFILE_IMAGES[randomIdx];

    case 'cover':
      // Picsum - 넓은 가로형 이미지
      return `https://picsum.photos/seed/${seed}/${w}/${h}`;

    case 'post':
      // Picsum - 포스트용 이미지
      return `https://picsum.photos/seed/post${seed}/${w}/${h}`;

    case 'product':
      // Picsum - 상품 이미지
      return `https://picsum.photos/seed/product${seed}/${w}/${h}`;

    case 'nature':
      // Picsum - 자연 이미지 (특정 카테고리 없어서 일반 이미지)
      return `https://picsum.photos/seed/nature${seed}/${w}/${h}`;

    case 'food':
      // Picsum - 음식 이미지
      return `https://picsum.photos/seed/food${seed}/${w}/${h}`;

    default:
      return `https://picsum.photos/seed/${seed}/${w}/${h}`;
  }
}

// 이미지 데이터 가져오기
async function fetchImageData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (e) {
    console.error('Fetch image error:', e);
    return null;
  }
}

// ===== 디자인 시스템 체커 =====

// 노드 선택하기
function selectNodeById(nodeId) {
  try {
    const node = figma.getNodeById(nodeId);
    if (node && 'type' in node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.ui.postMessage({
        type: 'checker-status',
        status: 'success',
        message: `"${node.name}" 선택됨`
      });
    }
  } catch (e) {
    figma.ui.postMessage({
      type: 'checker-status',
      status: 'error',
      message: '노드를 찾을 수 없습니다.'
    });
  }
}

// 여러 노드 선택하기
function selectMultipleNodes(nodeIds) {
  try {
    const nodes = [];
    for (const id of nodeIds) {
      const node = figma.getNodeById(id);
      if (node && 'type' in node) {
        nodes.push(node);
      }
    }

    if (nodes.length > 0) {
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      figma.ui.postMessage({
        type: 'checker-status',
        status: 'success',
        message: `${nodes.length}개 레이어 선택됨`
      });
    }
  } catch (e) {
    figma.ui.postMessage({
      type: 'checker-status',
      status: 'error',
      message: '노드를 찾을 수 없습니다.'
    });
  }
}

// 디자인 시스템 스캔
function scanDesignSystem(checkerType) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'checker-status',
      status: 'error',
      message: '먼저 레이어를 선택해주세요.'
    });
    return;
  }

  let results = [];

  switch (checkerType) {
    case 'component':
      results = checkComponents(selection);
      break;
    case 'variable':
      results = checkVariables(selection);
      break;
    case 'textstyle':
      results = checkTextStyles(selection);
      break;
  }

  figma.ui.postMessage({
    type: 'checker-results',
    checkerType: checkerType,
    results: results
  });
}

// 컴포넌트 체크 - 디자인 시스템 컴포넌트가 아닌 레이어 찾기
function checkComponents(selection) {
  const results = [];

  function checkNode(node) {
    // COMPONENT_SET, COMPONENT는 디자인 시스템 컴포넌트이므로 패스
    if (node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
      results.push({
        nodeId: node.id,
        name: node.name,
        type: 'component',
        detail: '디자인 시스템 컴포넌트',
        badge: '적용됨',
        isApplied: true,
        severity: 'success'
      });
      return;
    }

    // INSTANCE는 컴포넌트 인스턴스이므로 적용됨
    if (node.type === 'INSTANCE') {
      // 메인 컴포넌트 정보 확인
      let componentName = '알 수 없는 컴포넌트';
      try {
        if (node.mainComponent) {
          componentName = node.mainComponent.name;
        }
      } catch (e) {}

      results.push({
        nodeId: node.id,
        name: node.name,
        type: 'component',
        detail: `인스턴스: ${componentName}`,
        badge: '적용됨',
        isApplied: true,
        severity: 'success'
      });

      // 인스턴스 내부는 검사하지 않음
      return;
    }

    // FRAME, GROUP, SECTION 등 컨테이너는 컴포넌트가 아닌 일반 레이어
    if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION') {
      results.push({
        nodeId: node.id,
        name: node.name,
        type: 'component',
        detail: `${getShortType(node.type)} - 컴포넌트 아님`,
        badge: '미적용',
        isApplied: false,
        severity: 'error'
      });
    }

    // 자식 노드 검사
    if ('children' in node && node.children) {
      for (const child of node.children) {
        checkNode(child);
      }
    }
  }

  for (const node of selection) {
    checkNode(node);
  }

  return results;
}

// 베리어블 체크 - 색상/크기 등에 변수가 적용되지 않은 레이어 찾기
function checkVariables(selection) {
  const results = [];

  function checkNode(node) {
    // fills 체크 (색상 변수)
    if ('fills' in node && Array.isArray(node.fills) && node.fills !== figma.mixed) {
      let hasVariableFill = false;

      // boundVariables 체크
      try {
        if (node.boundVariables && node.boundVariables.fills) {
          hasVariableFill = true;
        }
      } catch (e) {}

      // fills가 있고 SOLID 타입인데 변수가 적용되지 않은 경우
      const solidFills = node.fills.filter(fill => fill.type === 'SOLID' && fill.visible !== false);

      if (solidFills.length > 0 && !hasVariableFill) {
        // 색상 정보 추출
        const fill = solidFills[0];
        const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);

        results.push({
          nodeId: node.id,
          name: node.name,
          type: 'variable',
          detail: `Fill 색상: ${hex}`,
          badge: '미적용',
          isApplied: false,
          severity: 'warning'
        });
      } else if (hasVariableFill) {
        results.push({
          nodeId: node.id,
          name: node.name,
          type: 'variable',
          detail: 'Fill 베리어블 적용됨',
          badge: '적용됨',
          isApplied: true,
          severity: 'success'
        });
      }
    }

    // strokes 체크 (스트로크 색상 변수)
    if ('strokes' in node && Array.isArray(node.strokes) && node.strokes !== figma.mixed) {
      let hasVariableStroke = false;

      try {
        if (node.boundVariables && node.boundVariables.strokes) {
          hasVariableStroke = true;
        }
      } catch (e) {}

      const solidStrokes = node.strokes.filter(stroke => stroke.type === 'SOLID' && stroke.visible !== false);

      if (solidStrokes.length > 0 && !hasVariableStroke) {
        const stroke = solidStrokes[0];
        const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);

        results.push({
          nodeId: node.id,
          name: node.name,
          type: 'variable',
          detail: `Stroke 색상: ${hex}`,
          badge: '미적용',
          isApplied: false,
          severity: 'warning'
        });
      }
    }

    // 자식 노드 검사
    if ('children' in node && node.children) {
      for (const child of node.children) {
        checkNode(child);
      }
    }
  }

  for (const node of selection) {
    checkNode(node);
  }

  return results;
}

// ===== Notion 비교 기능 =====

// 노션 내용과 Figma 텍스트 비교
// ===== Code2Design 기능 =====

// 코드에서 Figma 디자인 생성
async function generateDesignFromCode(codeType, parsed, rawCode) {
  console.log('generateDesignFromCode 호출됨');
  console.log('codeType:', codeType);
  console.log('rawCode 길이:', rawCode ? rawCode.length : 0);

  try {
    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'info',
      message: '디자인 생성 중...'
    });

    // TextStyleGuide 같은 특수 컴포넌트 감지
    if (rawCode && (rawCode.includes('TextStyleGuide') || rawCode.includes('tsg-root'))) {
      console.log('TextStyleGuide 감지됨, 생성 시작');
      await createTextStyleGuide(parsed, rawCode);
      return;
    }

    // 일반 코드 파싱하여 디자인 생성
    console.log('일반 디자인 생성 시작');
    await createGenericDesign(parsed, rawCode);

  } catch (e) {
    console.error('디자인 생성 에러:', e);
    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'error',
      message: '디자인 생성 실패: ' + e.message
    });
  }
}

// TextStyleGuide 컴포넌트 생성
async function createTextStyleGuide(parsed, rawCode) {
  console.log('createTextStyleGuide 시작');

  try {
    // 폰트 로드
    console.log('폰트 로딩 중...');
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    console.log('폰트 로딩 완료');

  // 메인 프레임 생성
  const mainFrame = figma.createFrame();
  mainFrame.name = "Typography / Text Style Guide";
  mainFrame.resize(1280, 800);
  mainFrame.fills = [{ type: 'SOLID', color: hexToRgb('#f6f6f3') }];
  mainFrame.cornerRadius = 0;
  mainFrame.layoutMode = 'VERTICAL';
  mainFrame.paddingTop = 32;
  mainFrame.paddingBottom = 32;
  mainFrame.paddingLeft = 32;
  mainFrame.paddingRight = 32;
  mainFrame.itemSpacing = 20;
  mainFrame.primaryAxisSizingMode = 'AUTO';

  // 헤더 섹션
  const header = figma.createFrame();
  header.name = "Header";
  header.layoutMode = 'VERTICAL';
  header.itemSpacing = 8;
  header.fills = [];

  const title = figma.createText();
  title.characters = "Typography / Text Style Guide";
  title.fontSize = 40;
  title.fontName = { family: "Inter", style: "Bold" };
  title.fills = [{ type: 'SOLID', color: hexToRgb('#1d1f1a') }];
  header.appendChild(title);

  const subtitle = figma.createText();
  subtitle.characters = "브랜드 전반에서 일관된 가독성과 계층을 위한 텍스트 시스템";
  subtitle.fontSize = 16;
  subtitle.fontName = { family: "Inter", style: "Regular" };
  subtitle.fills = [{ type: 'SOLID', color: hexToRgb('#5c6254') }];
  header.appendChild(subtitle);

  mainFrame.appendChild(header);
  // FILL/HUG는 부모에 추가된 후 설정
  header.layoutSizingHorizontal = 'FILL';
  header.layoutSizingVertical = 'HUG';

  // 컬럼 헤더
  const colHeader = figma.createFrame();
  colHeader.name = "Column Header";
  colHeader.layoutMode = 'HORIZONTAL';
  colHeader.itemSpacing = 12;
  colHeader.fills = [{ type: 'SOLID', color: hexToRgb('#ecede6') }];
  colHeader.strokes = [{ type: 'SOLID', color: hexToRgb('#d9dbd1') }];
  colHeader.strokeWeight = 1;
  colHeader.cornerRadius = 10;
  colHeader.paddingTop = 10;
  colHeader.paddingBottom = 10;
  colHeader.paddingLeft = 14;
  colHeader.paddingRight = 14;

  const col1Header = figma.createText();
  col1Header.characters = "Style";
  col1Header.fontSize = 13;
  col1Header.fontName = { family: "Inter", style: "Semi Bold" };
  col1Header.fills = [{ type: 'SOLID', color: hexToRgb('#394031') }];
  col1Header.resize(220, col1Header.height);
  colHeader.appendChild(col1Header);

  const col2Header = figma.createText();
  col2Header.characters = "Sample";
  col2Header.fontSize = 13;
  col2Header.fontName = { family: "Inter", style: "Semi Bold" };
  col2Header.fills = [{ type: 'SOLID', color: hexToRgb('#394031') }];
  col2Header.layoutGrow = 1;
  colHeader.appendChild(col2Header);

  const col3Header = figma.createText();
  col3Header.characters = "Spec";
  col3Header.fontSize = 13;
  col3Header.fontName = { family: "Inter", style: "Semi Bold" };
  col3Header.fills = [{ type: 'SOLID', color: hexToRgb('#394031') }];
  col3Header.textAlignHorizontal = 'RIGHT';
  col3Header.resize(280, col3Header.height);
  colHeader.appendChild(col3Header);

  mainFrame.appendChild(colHeader);
  // FILL/HUG는 부모에 추가된 후 설정
  colHeader.layoutSizingHorizontal = 'FILL';
  colHeader.layoutSizingVertical = 'HUG';

  // 행 데이터
  const rows = [
    { style: "Display", sample: "Build with Clarity", spec: "56 / 700 / 105%", fontSize: 56, fontWeight: "Bold", color: "#11130F" },
    { style: "Heading 1", sample: "Product Principles", spec: "40 / 700 / 110%", fontSize: 40, fontWeight: "Bold", color: "#151713" },
    { style: "Heading 2", sample: "Section Overview", spec: "32 / 600 / 115%", fontSize: 32, fontWeight: "Semi Bold", color: "#1A1D18" },
    { style: "Heading 3", sample: "Card Title", spec: "24 / 600 / 120%", fontSize: 24, fontWeight: "Semi Bold", color: "#20241D" },
    { style: "Title", sample: "Feature Overview", spec: "20 / 600 / 125%", fontSize: 20, fontWeight: "Semi Bold", color: "#20241D" },
    { style: "Body / Large", sample: "Readable paragraph for key explanations and section intro.", spec: "18 / 500 / 150%", fontSize: 18, fontWeight: "Medium", color: "#2A3023" },
    { style: "Body / Default", sample: "Default content text used in most product surfaces.", spec: "16 / 400 / 160%", fontSize: 16, fontWeight: "Regular", color: "#2E3428" },
    { style: "Caption", sample: "Helper text, metadata, and supportive hints.", spec: "14 / 400 / 150%", fontSize: 14, fontWeight: "Regular", color: "#4F5645" },
    { style: "Overline", sample: "SYSTEM LABEL", spec: "12 / 600 / 130%", fontSize: 12, fontWeight: "Semi Bold", color: "#4B5340" },
  ];

  // 행들을 담을 컨테이너
  const rowsContainer = figma.createFrame();
  rowsContainer.name = "Rows";
  rowsContainer.layoutMode = 'VERTICAL';
  rowsContainer.itemSpacing = 10;
  rowsContainer.fills = [];

  for (const rowData of rows) {
    const row = figma.createFrame();
    row.name = rowData.style;
    row.layoutMode = 'HORIZONTAL';
    row.itemSpacing = 12;
    row.fills = [{ type: 'SOLID', color: hexToRgb('#ffffff') }];
    row.strokes = [{ type: 'SOLID', color: hexToRgb('#e4e6dd') }];
    row.strokeWeight = 1;
    row.cornerRadius = 10;
    row.paddingTop = 14;
    row.paddingBottom = 14;
    row.paddingLeft = 14;
    row.paddingRight = 14;
    row.counterAxisAlignItems = 'CENTER';

    // Style 이름
    const styleLabel = figma.createText();
    styleLabel.characters = rowData.style;
    styleLabel.fontSize = 14;
    styleLabel.fontName = { family: "Inter", style: "Semi Bold" };
    styleLabel.fills = [{ type: 'SOLID', color: hexToRgb('#2a3023') }];
    styleLabel.resize(220, styleLabel.height);
    row.appendChild(styleLabel);

    // Sample 텍스트
    const sampleText = figma.createText();
    sampleText.characters = rowData.sample;
    sampleText.fontSize = rowData.fontSize;
    sampleText.fontName = { family: "Inter", style: rowData.fontWeight };
    sampleText.fills = [{ type: 'SOLID', color: hexToRgb(rowData.color) }];
    sampleText.layoutGrow = 1;
    row.appendChild(sampleText);

    // Spec
    const specText = figma.createText();
    specText.characters = rowData.spec;
    specText.fontSize = 13;
    specText.fontName = { family: "Inter", style: "Medium" };
    specText.fills = [{ type: 'SOLID', color: hexToRgb('#58614d') }];
    specText.textAlignHorizontal = 'RIGHT';
    specText.resize(280, specText.height);
    row.appendChild(specText);

    rowsContainer.appendChild(row);
    // FILL/HUG는 부모에 추가된 후 설정
    row.layoutSizingHorizontal = 'FILL';
    row.layoutSizingVertical = 'HUG';
  }

  mainFrame.appendChild(rowsContainer);
  // FILL/HUG는 부모에 추가된 후 설정
  rowsContainer.layoutSizingHorizontal = 'FILL';
  rowsContainer.layoutSizingVertical = 'HUG';

  // 노트 섹션
  const note = figma.createFrame();
  note.name = "Note";
  note.layoutMode = 'VERTICAL';
  note.itemSpacing = 6;
  note.fills = [{ type: 'SOLID', color: hexToRgb('#ecede6') }];
  note.strokes = [{ type: 'SOLID', color: hexToRgb('#d9dbd1') }];
  note.strokeWeight = 1;
  note.cornerRadius = 10;
  note.paddingTop = 14;
  note.paddingBottom = 14;
  note.paddingLeft = 16;
  note.paddingRight = 16;

  const noteTitle = figma.createText();
  noteTitle.characters = "Usage Rule";
  noteTitle.fontSize = 13;
  noteTitle.fontName = { family: "Inter", style: "Semi Bold" };
  noteTitle.fills = [{ type: 'SOLID', color: hexToRgb('#2a3023') }];
  note.appendChild(noteTitle);

  const noteDesc = figma.createText();
  noteDesc.characters = "Line-height is locked to each tier to keep rhythm consistent across cards, tables, and forms.";
  noteDesc.fontSize = 13;
  noteDesc.fontName = { family: "Inter", style: "Regular" };
  noteDesc.fills = [{ type: 'SOLID', color: hexToRgb('#58614d') }];
  note.appendChild(noteDesc);

  mainFrame.appendChild(note);
  // FILL/HUG는 부모에 추가된 후 설정
  note.layoutSizingHorizontal = 'FILL';
  note.layoutSizingVertical = 'HUG';

    // 현재 페이지에 추가
    console.log('페이지에 프레임 추가 중...');
    figma.currentPage.appendChild(mainFrame);

    // 뷰포트 이동
    figma.viewport.scrollAndZoomIntoView([mainFrame]);

    // 선택
    figma.currentPage.selection = [mainFrame];

    console.log('TextStyleGuide 생성 완료!');
    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'success',
      message: 'TextStyleGuide 디자인이 생성되었습니다!'
    });

  } catch (e) {
    console.error('createTextStyleGuide 에러:', e);
    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'error',
      message: '생성 실패: ' + e.message
    });
  }
}

// 일반 디자인 생성
async function createGenericDesign(parsed, rawCode) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const mainFrame = figma.createFrame();
  mainFrame.name = "Generated Design";
  mainFrame.resize(800, 600);
  mainFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  mainFrame.layoutMode = 'VERTICAL';
  mainFrame.paddingTop = 24;
  mainFrame.paddingBottom = 24;
  mainFrame.paddingLeft = 24;
  mainFrame.paddingRight = 24;
  mainFrame.itemSpacing = 16;

  // 헤더가 있으면 추가
  if (parsed.elements.length > 0) {
    const header = parsed.elements.find(e => e.type === 'header');
    if (header) {
      const titleText = figma.createText();
      titleText.characters = header.title || "Generated Design";
      titleText.fontSize = 32;
      titleText.fontName = { family: "Inter", style: "Bold" };
      mainFrame.appendChild(titleText);

      if (header.subtitle) {
        const subtitleText = figma.createText();
        subtitleText.characters = header.subtitle;
        subtitleText.fontSize = 16;
        subtitleText.fontName = { family: "Inter", style: "Regular" };
        subtitleText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
        mainFrame.appendChild(subtitleText);
      }
    }
  }

  figma.currentPage.appendChild(mainFrame);
  figma.viewport.scrollAndZoomIntoView([mainFrame]);
  figma.currentPage.selection = [mainFrame];

  figma.ui.postMessage({
    type: 'code2design-status',
    status: 'success',
    message: '디자인이 생성되었습니다!'
  });
}

// Gemini AI 응답 JSON으로 Figma 디자인 생성
async function createDesignFromGeminiResponse(data) {
  figma.ui.postMessage({ type: 'code2design-status', status: 'info', message: 'Figma 프레임 생성 중...' });

  try {
    // 폰트 미리 로드
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });

    // 메인 프레임 생성
    const mainFrame = figma.createFrame();
    mainFrame.name = data.name || 'Tailwind Design';
    mainFrame.resize(data.width || 375, data.height || 600);
    if (data.backgroundColor) {
      mainFrame.fills = [{ type: 'SOLID', color: hexToRgb(data.backgroundColor) }];
    } else {
      mainFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    }

    // 재귀 노드 생성 함수
    async function createNode(nodeData, parentNode) {
      var type = nodeData.type || 'frame';
      var node;

      if (type === 'text') {
        node = figma.createText();
        node.name = nodeData.name || 'Text';
        try {
          if (nodeData.fontWeight === 'Bold') {
            await figma.loadFontAsync({ family: "Inter", style: "Bold" });
            node.fontName = { family: "Inter", style: "Bold" };
          } else if (nodeData.fontWeight === 'Medium') {
            await figma.loadFontAsync({ family: "Inter", style: "Medium" });
            node.fontName = { family: "Inter", style: "Medium" };
          } else {
            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            node.fontName = { family: "Inter", style: "Regular" };
          }
        } catch(e) {}
        node.characters = nodeData.content || '';
        node.fontSize = nodeData.fontSize || 14;
        if (nodeData.color) {
          node.fills = [{ type: 'SOLID', color: hexToRgb(nodeData.color) }];
        }
      } else if (type === 'ellipse') {
        node = figma.createEllipse();
        node.name = nodeData.name || 'Ellipse';
        if (nodeData.fill) {
          node.fills = [{ type: 'SOLID', color: hexToRgb(nodeData.fill) }];
        }
      } else if (type === 'rect') {
        node = figma.createRectangle();
        node.name = nodeData.name || 'Rectangle';
        if (nodeData.fill) {
          node.fills = [{ type: 'SOLID', color: hexToRgb(nodeData.fill) }];
        }
        if (nodeData.cornerRadius) node.cornerRadius = nodeData.cornerRadius;
      } else {
        // frame (기본)
        node = figma.createFrame();
        node.name = nodeData.name || 'Frame';
        node.fills = nodeData.fill
          ? [{ type: 'SOLID', color: hexToRgb(nodeData.fill) }]
          : [];
        if (nodeData.cornerRadius) node.cornerRadius = nodeData.cornerRadius;
        // 자식 노드 먼저 추가
        if (nodeData.children && nodeData.children.length) {
          for (var i = 0; i < nodeData.children.length; i++) {
            await createNode(nodeData.children[i], node);
          }
        }
      }

      // 위치 및 크기 설정
      node.x = nodeData.x || 0;
      node.y = nodeData.y || 0;
      if (nodeData.width && nodeData.height) {
        try { node.resize(nodeData.width, nodeData.height); } catch(e) {}
      }

      parentNode.appendChild(node);
    }

    // 최상위 elements 생성
    if (data.elements && data.elements.length) {
      for (var i = 0; i < data.elements.length; i++) {
        await createNode(data.elements[i], mainFrame);
      }
    }

    // 캔버스에 추가 및 뷰포트 이동
    figma.currentPage.appendChild(mainFrame);
    figma.currentPage.selection = [mainFrame];
    figma.viewport.scrollAndZoomIntoView([mainFrame]);

    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'success',
      message: '✅ Tailwind 디자인이 생성되었습니다! (' + (data.elements ? data.elements.length : 0) + '개 요소)'
    });

  } catch(e) {
    console.error('createDesignFromGeminiResponse 오류:', e);
    figma.ui.postMessage({
      type: 'code2design-status',
      status: 'error',
      message: '디자인 생성 실패: ' + e.message
    });
  }
}

// 텍스트 스타일 체크 - 텍스트 스타일이 적용되지 않은 텍스트 레이어 찾기
function checkTextStyles(selection) {
  const results = [];

  function checkNode(node) {
    // 텍스트 노드만 검사
    if (node.type === 'TEXT') {
      // textStyleId 체크
      let hasTextStyle = false;
      let styleName = '';

      try {
        if (node.textStyleId && node.textStyleId !== figma.mixed && node.textStyleId !== '') {
          hasTextStyle = true;
          // 스타일 이름 가져오기
          const style = figma.getStyleById(node.textStyleId);
          if (style) {
            styleName = style.name;
          }
        }
      } catch (e) {}

      if (hasTextStyle) {
        results.push({
          nodeId: node.id,
          name: node.name,
          type: 'textstyle',
          detail: `스타일: ${styleName}`,
          badge: '적용됨',
          isApplied: true,
          severity: 'success'
        });
      } else {
        // 폰트 정보 추출
        let fontInfo = '';
        try {
          if (node.fontName !== figma.mixed) {
            fontInfo = `${node.fontName.family} ${node.fontName.style}`;
          } else {
            fontInfo = '혼합 폰트';
          }

          if (node.fontSize !== figma.mixed) {
            fontInfo += ` / ${node.fontSize}px`;
          }
        } catch (e) {
          fontInfo = '폰트 정보 없음';
        }

        results.push({
          nodeId: node.id,
          name: node.name,
          type: 'textstyle',
          detail: fontInfo,
          badge: '미적용',
          isApplied: false,
          severity: 'error'
        });
      }
    }

    // INSTANCE 내부의 텍스트도 검사
    if ('children' in node && node.children) {
      for (const child of node.children) {
        checkNode(child);
      }
    }
  }

  for (const node of selection) {
    checkNode(node);
  }

  return results;
}

// ===== Variables 생성 기능 =====

// HEX를 Figma RGB로 변환 (0-1 범위)
function hexToFigmaRgb(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '');

  // 3자리 HEX를 6자리로 변환
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // 8자리 HEX (알파 포함)
  let alpha = 1;
  if (hex.length === 8) {
    alpha = parseInt(hex.slice(6, 8), 16) / 255;
    hex = hex.slice(0, 6);
  }

  if (hex.length !== 6) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  return { r, g, b, a: alpha };
}

// RGB/RGBA 문자열 파싱
function parseRgbString(str) {
  const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return null;

  return {
    r: parseInt(match[1]) / 255,
    g: parseInt(match[2]) / 255,
    b: parseInt(match[3]) / 255,
    a: match[4] ? parseFloat(match[4]) : 1
  };
}

// 색상 값을 Figma 색상 객체로 변환
function parseColorValue(value) {
  if (typeof value === 'string') {
    // HEX
    if (value.startsWith('#')) {
      return hexToFigmaRgb(value);
    }
    // RGB/RGBA
    if (value.startsWith('rgb')) {
      return parseRgbString(value);
    }
  }
  return null;
}

// 토큰에서 Figma 베리어블 생성
async function createVariablesFromTokens(collectionName, tokens) {
  try {
    figma.ui.postMessage({
      type: 'variables-status',
      status: 'info',
      message: '베리어블 컬렉션 생성 중...'
    });

    // 기존 컬렉션 찾기 또는 새로 생성
    let collection = figma.variables.getLocalVariableCollections()
      .find(c => c.name === collectionName);

    if (!collection) {
      collection = figma.variables.createVariableCollection(collectionName);
    }

    // 기본 모드 ID 가져오기 (Figma modes: { modeId, name })
    const modeId = collection.modes[0].modeId;

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const token of tokens) {
      try {
        // 이미 존재하는 변수 확인
        const existingVar = figma.variables.getLocalVariables()
          .find(v => v.name === token.name && v.variableCollectionId === collection.id);

        if (existingVar) {
          skippedCount++;
          continue;
        }

        let variable;
        let value;

        switch (token.type) {
          case 'color':
            const colorValue = parseColorValue(token.value);
            if (!colorValue) {
              errors.push(`색상 파싱 실패: ${token.name}`);
              continue;
            }
            variable = figma.variables.createVariable(token.name, collection, 'COLOR');
            value = { r: colorValue.r, g: colorValue.g, b: colorValue.b, a: colorValue.a };
            break;

          case 'number':
            variable = figma.variables.createVariable(token.name, collection, 'FLOAT');
            value = typeof token.value === 'string' ? parseFloat(token.value) : token.value;
            break;

          case 'string':
            variable = figma.variables.createVariable(token.name, collection, 'STRING');
            value = String(token.value);
            break;

          default:
            errors.push(`알 수 없는 타입: ${token.type} (${token.name})`);
            continue;
        }

        // 값 설정
        variable.setValueForMode(modeId, value);
        createdCount++;

      } catch (e) {
        errors.push(`${token.name}: ${e.message}`);
      }
    }

    // 결과 메시지
    let message = `✅ ${createdCount}개 베리어블 생성 완료!`;
    if (skippedCount > 0) {
      message += ` (${skippedCount}개 중복 스킵)`;
    }
    if (errors.length > 0) {
      message += `\n⚠️ ${errors.length}개 에러 발생`;
      console.log('Variable creation errors:', errors);
    }

    figma.ui.postMessage({
      type: 'variables-status',
      status: errors.length > 0 ? 'warning' : 'success',
      message: message
    });

  } catch (e) {
    console.error('베리어블 생성 에러:', e);
    figma.ui.postMessage({
      type: 'variables-status',
      status: 'error',
      message: '베리어블 생성 실패: ' + e.message
    });
  }
}

// ===== Text Styles 생성 기능 =====

// fontWeight 문자열을 Figma fontName style로 변환
function fontWeightToStyle(weight) {
  const weightMap = {
    'regular': 'Regular',
    'medium': 'Medium',
    'semibold': 'Semi Bold',
    'bold': 'Bold',
    'light': 'Light',
    'thin': 'Thin',
    'black': 'Black',
    'extrabold': 'Extra Bold',
    'extralight': 'Extra Light'
  };
  const normalized = String(weight).toLowerCase().replace(/[\s-_]/g, '');
  return weightMap[normalized] || 'Regular';
}

// 텍스트 스타일 생성
async function createTextStylesFromTokens(tokens) {
  try {
    figma.ui.postMessage({
      type: 'variables-status',
      status: 'info',
      message: '텍스트 스타일 생성 중...'
    });

    // 폰트 로드
    const fontsToLoad = new Set();
    for (const token of tokens) {
      const fontFamily = token.fontFamily || 'Inter';
      const fontStyle = fontWeightToStyle(token.fontWeight || 'Regular');
      fontsToLoad.add(JSON.stringify({ family: fontFamily, style: fontStyle }));
    }

    for (const fontStr of fontsToLoad) {
      const font = JSON.parse(fontStr);
      try {
        await figma.loadFontAsync(font);
      } catch (e) {
        console.warn(`폰트 로드 실패: ${font.family} ${font.style}`, e);
        // Inter로 폴백
        await figma.loadFontAsync({ family: 'Inter', style: font.style });
      }
    }

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    // 기존 텍스트 스타일 목록 가져오기
    const existingStyles = figma.getLocalTextStyles();
    const existingNames = new Set(existingStyles.map(s => s.name));

    for (const token of tokens) {
      try {
        // 이미 존재하는 스타일 확인
        if (existingNames.has(token.name)) {
          skippedCount++;
          continue;
        }

        // 텍스트 스타일 생성
        const textStyle = figma.createTextStyle();
        textStyle.name = token.name;

        // 폰트 설정
        const fontFamily = token.fontFamily || 'Inter';
        const fontStyle = fontWeightToStyle(token.fontWeight || 'Regular');
        
        try {
          textStyle.fontName = { family: fontFamily, style: fontStyle };
        } catch (e) {
          // Inter로 폴백
          textStyle.fontName = { family: 'Inter', style: fontStyle };
        }

        // 폰트 크기
        if (token.fontSize) {
          textStyle.fontSize = typeof token.fontSize === 'string' 
            ? parseFloat(token.fontSize) 
            : token.fontSize;
        }

        // 라인 높이
        if (token.lineHeight) {
          const lh = typeof token.lineHeight === 'string' 
            ? parseFloat(token.lineHeight) 
            : token.lineHeight;
          textStyle.lineHeight = { value: lh, unit: 'PIXELS' };
        }

        // 자간 (letterSpacing)
        if (token.letterSpacing !== undefined) {
          const ls = typeof token.letterSpacing === 'string'
            ? parseFloat(token.letterSpacing)
            : token.letterSpacing;
          textStyle.letterSpacing = { value: ls, unit: 'PIXELS' };
        }

        createdCount++;

      } catch (e) {
        errors.push(`${token.name}: ${e.message}`);
      }
    }

    // 결과 메시지
    let message = `✅ ${createdCount}개 텍스트 스타일 생성 완료!`;
    if (skippedCount > 0) {
      message += ` (${skippedCount}개 중복 스킵)`;
    }
    if (errors.length > 0) {
      message += `\n⚠️ ${errors.length}개 에러 발생`;
      console.log('Text style creation errors:', errors);
    }

    figma.ui.postMessage({
      type: 'variables-status',
      status: errors.length > 0 ? 'warning' : 'success',
      message: message
    });

  } catch (e) {
    console.error('텍스트 스타일 생성 에러:', e);
    figma.ui.postMessage({
      type: 'variables-status',
      status: 'error',
      message: '텍스트 스타일 생성 실패: ' + e.message
    });
  }
}

// ===== .pen 프레임 → Figma 프레임 변환 =====

// .pen 변수 테이블 ($--xxx → hex 색상)
var penVariables = {};

// $--변수명을 실제 색상으로 해석
function resolvePenColor(value) {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  // 변수 참조인 경우
  if (value.charAt(0) === '$') {
    var key = value.slice(1); // '$--bg-default' → '--bg-default'
    var v = penVariables[key];
    if (v && v.value) return v.value;
    return null; // 변수를 못 찾으면 null
  }
  return value; // 일반 hex 그대로 반환
}

async function convertPenFrames(penFrames, variables) {
  try {
    // 변수 테이블 저장
    penVariables = variables || {};

    let createdCount = 0;
    const errors = [];

    for (var fi = 0; fi < penFrames.length; fi++) {
      var penFrame = penFrames[fi];
      try {
        // 진행 상황 실시간 전송
        figma.ui.postMessage({
          type: 'pen-convert-progress',
          current: fi + 1,
          total: penFrames.length,
          name: penFrame.name || ('프레임 ' + (fi + 1))
        });

        var figmaFrame = await convertPenNode(penFrame);
        if (figmaFrame) {
          figma.currentPage.appendChild(figmaFrame);
          // 최상위 프레임: x/y 위치
          figmaFrame.x = (typeof penFrame.x === 'number') ? penFrame.x : (fi * 400);
          figmaFrame.y = (typeof penFrame.y === 'number') ? penFrame.y : 0;
          // height가 null/없는 최상위 프레임 → HUG (내용에 맞게)
          if (figmaFrame.layoutMode !== 'NONE') {
            if (!(typeof penFrame.height === 'number' && penFrame.height > 0)) {
              try { figmaFrame.layoutSizingVertical = 'HUG'; } catch(e) {}
            }
            if (!(typeof penFrame.width === 'number' && penFrame.width > 0)) {
              try { figmaFrame.layoutSizingHorizontal = 'HUG'; } catch(e) {}
            }
          }
          createdCount++;
        }
      } catch (e) {
        errors.push((penFrame.name || '프레임') + ': ' + e.message);
        console.error('프레임 변환 에러:', e);
      }
    }

    var message = '✅ ' + createdCount + '개 프레임 변환 완료!';
    if (errors.length > 0) message += '\n⚠️ ' + errors.length + '개 에러';

    figma.ui.postMessage({
      type: 'pen-convert-status',
      status: errors.length > 0 ? 'warning' : 'success',
      message: message
    });

  } catch (e) {
    console.error('.pen 변환 에러:', e);
    figma.ui.postMessage({
      type: 'pen-convert-status',
      status: 'error',
      message: '변환 실패: ' + e.message
    });
  }
}

// justifyContent/alignItems → Figma PRIMARY/COUNTER 정렬
function mapJustify(val) {
  var map = {
    start: 'MIN', flex_start: 'MIN', 'flex-start': 'MIN',
    center: 'CENTER',
    end: 'MAX', flex_end: 'MAX', 'flex-end': 'MAX',
    space_between: 'SPACE_BETWEEN', 'space-between': 'SPACE_BETWEEN'
  };
  return map[val] || 'MIN';
}

function mapAlignItems(val) {
  var map = {
    start: 'MIN', flex_start: 'MIN', 'flex-start': 'MIN',
    center: 'CENTER',
    end: 'MAX', flex_end: 'MAX', 'flex-end': 'MAX',
    baseline: 'BASELINE'
  };
  return map[val] || 'MIN';
}

// .pen 노드 → Figma 노드 재귀 변환
// parentPenNode: 부모 .pen 노드 (fill_container 처리에 사용)
async function convertPenNode(penNode, parentPenNode) {
  if (!penNode || !penNode.type) return null;

  var type = penNode.type;

  // ── icon_font: 아이콘 컬러 원형 프레임 ──
  if (type === 'icon_font') {
    var iconW = (typeof penNode.width === 'number' && penNode.width > 0) ? penNode.width : 24;
    var iconH = (typeof penNode.height === 'number' && penNode.height > 0) ? penNode.height : 24;
    var iconColorStr = resolvePenColor(penNode.fill);
    var iconRgb = iconColorStr ? hexToFigmaRgb(iconColorStr) : null;

    // 아이콘을 단색 원 또는 사각형으로 표현 (Lucide 계열은 원형)
    var iconEl = figma.createEllipse();
    iconEl.name = penNode.name || 'Icon';
    iconEl.resize(iconW, iconH);
    if (iconRgb) {
      var iconFill = { type: 'SOLID', color: { r: iconRgb.r, g: iconRgb.g, b: iconRgb.b } };
      if (iconRgb.a !== undefined && iconRgb.a < 0.999) iconFill.opacity = iconRgb.a;
      iconEl.fills = [iconFill];
    } else {
      iconEl.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.65 } }];
    }
    iconEl.strokes = [];
    return iconEl;
  }

  // ── frame / group ──
  if (type === 'frame' || type === 'group') {
    var frame = figma.createFrame();
    frame.name = penNode.name || 'Frame';
    frame.clipsContent = penNode.clip !== false; // 기본 true

    // 부모가 Auto Layout인지 확인
    var parentHasLayout = parentPenNode && (
      parentPenNode.layout === 'horizontal' ||
      parentPenNode.layout === 'vertical' ||
      parentPenNode.justifyContent || parentPenNode.alignItems ||
      parentPenNode.gap != null || parentPenNode.padding != null
    );

    // 크기 결정
    var wSpec = penNode.width;   // 'fill_container' | number | null
    var hSpec = penNode.height;  // 'fill_container' | number | null
    var wNum = (typeof wSpec === 'number' && wSpec > 0) ? wSpec : 100;
    var hNum = (typeof hSpec === 'number' && hSpec > 0) ? hSpec : 100;

    // fill_container인데 부모에 Auto Layout 없으면 → 부모 크기 그대로 사용
    if (wSpec === 'fill_container' && !parentHasLayout && parentPenNode) {
      wNum = (typeof parentPenNode.width === 'number' && parentPenNode.width > 0) ? parentPenNode.width : 100;
    }
    if (hSpec === 'fill_container' && !parentHasLayout && parentPenNode) {
      hNum = (typeof parentPenNode.height === 'number' && parentPenNode.height > 0) ? parentPenNode.height : 100;
    }
    frame.resize(wNum, hNum);

    // 배경색
    applyPenFill(frame, penNode.fill);

    // 불투명도
    if (penNode.opacity != null) { try { frame.opacity = penNode.opacity; } catch(e) {} }

    // 모서리 반경
    if (penNode.cornerRadius != null) {
      try {
        if (Array.isArray(penNode.cornerRadius)) {
          frame.topLeftRadius     = penNode.cornerRadius[0] || 0;
          frame.topRightRadius    = penNode.cornerRadius[1] || 0;
          frame.bottomRightRadius = penNode.cornerRadius[2] || 0;
          frame.bottomLeftRadius  = penNode.cornerRadius[3] || 0;
        } else {
          frame.cornerRadius = penNode.cornerRadius;
        }
      } catch(e) {}
    }

    // ── Auto Layout 결정 ──
    var hasLayout = penNode.layout === 'horizontal' || penNode.layout === 'vertical';
    var hasAutoHints = (penNode.gap != null) || (penNode.padding != null) || (penNode.justifyContent) || (penNode.alignItems);

    if (hasLayout || hasAutoHints) {
      frame.layoutMode = (penNode.layout === 'vertical') ? 'VERTICAL' : 'HORIZONTAL';

      // 패딩 (number | [v,h] | [t,r,b,l])
      if (penNode.padding != null) {
        var p = penNode.padding;
        try {
          if (Array.isArray(p)) {
            if (p.length === 2) {
              frame.paddingTop = frame.paddingBottom = p[0] || 0;
              frame.paddingLeft = frame.paddingRight = p[1] || 0;
            } else if (p.length === 3) {
              frame.paddingTop = p[0] || 0;
              frame.paddingLeft = frame.paddingRight = p[1] || 0;
              frame.paddingBottom = p[2] || 0;
            } else if (p.length >= 4) {
              frame.paddingTop    = p[0] || 0;
              frame.paddingRight  = p[1] || 0;
              frame.paddingBottom = p[2] || 0;
              frame.paddingLeft   = p[3] || 0;
            }
          } else if (typeof p === 'number') {
            frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = p;
          }
        } catch(pe) {}
      }

      // 간격
      if (penNode.gap != null) { try { frame.itemSpacing = penNode.gap; } catch(e) {} }

      // 정렬
      try {
        frame.primaryAxisAlignItems = mapJustify(penNode.justifyContent || 'start');
        frame.counterAxisAlignItems = mapAlignItems(penNode.alignItems || 'start');
      } catch(e) {}

    } else {
      frame.layoutMode = 'NONE';
    }

    // 테두리
    applyPenStroke(frame, penNode);

    // ── 자식 노드 재귀 생성 ──
    if (Array.isArray(penNode.children)) {
      for (var ci = 0; ci < penNode.children.length; ci++) {
        var child = penNode.children[ci];
        try {
          var childNode = await convertPenNode(child, penNode);  // 부모 전달
          if (childNode) {
            frame.appendChild(childNode);
            // Auto Layout 자식: appendChild 후 sizing
            if (frame.layoutMode !== 'NONE') {
              applyPenSizing(childNode, child);
            } else {
              // Auto Layout 없는 부모: fill_container 자식 → 절대 위치(0,0) + 부모 크기
              applyAbsoluteSizing(childNode, child, frame);
            }
          }
        } catch (childErr) {
          console.warn('자식 변환 실패:', child.name, childErr.message);
        }
      }
    }

    // 자기 자신 sizing (Auto Layout 내부에서만 유효, 부모 append 후 적용됨)
    if (frame.layoutMode !== 'NONE') {
      try {
        if (wSpec !== 'fill_container' && !(typeof wSpec === 'number' && wSpec > 0)) {
          frame.layoutSizingHorizontal = 'HUG';
        }
        if (hSpec !== 'fill_container' && !(typeof hSpec === 'number' && hSpec > 0)) {
          frame.layoutSizingVertical = 'HUG';
        }
      } catch(e) {}
    }

    return frame;

  } else if (type === 'text') {
    // ── text ──
    var text = figma.createText();
    text.name = penNode.name || 'Text';

    // 폰트 로드 (Korean 폰트 → Noto Sans KR fallback)
    var fontFamily = penNode.fontFamily || 'Inter';
    var fontWeight = penNode.fontWeight || 400;
    var figmaStyle = penFontWeightToStyle(fontWeight);
    var loadedFamily = fontFamily;
    var loadedStyle = figmaStyle;

    // 폰트 로드 순서: 원본 → Noto Sans KR(한글) → Inter
    var fontLoaded = false;
    try {
      await figma.loadFontAsync({ family: fontFamily, style: figmaStyle });
      fontLoaded = true;
    } catch(fe) {}

    if (!fontLoaded) {
      // Bold/Regular 스타일 다양하게 시도
      var altStyles = ['Regular', 'Bold', 'Medium', 'Light'];
      for (var si = 0; si < altStyles.length; si++) {
        try {
          await figma.loadFontAsync({ family: fontFamily, style: altStyles[si] });
          loadedStyle = altStyles[si];
          fontLoaded = true;
          break;
        } catch(fe2) {}
      }
    }

    if (!fontLoaded) {
      // 한글 폰트 fallback
      var korFonts = [
        { family: 'Noto Sans KR', style: figmaStyle },
        { family: 'Noto Sans KR', style: 'Regular' },
        { family: 'Noto Sans KR', style: 'Bold' },
        { family: 'Inter', style: 'Regular' }
      ];
      for (var ki = 0; ki < korFonts.length; ki++) {
        try {
          await figma.loadFontAsync(korFonts[ki]);
          loadedFamily = korFonts[ki].family;
          loadedStyle = korFonts[ki].style;
          fontLoaded = true;
          break;
        } catch(fe3) {}
      }
    }

    if (!fontLoaded) {
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        loadedFamily = 'Inter';
        loadedStyle = 'Regular';
      } catch(fe4) {}
    }

    try { text.fontName = { family: loadedFamily, style: loadedStyle }; } catch(e) {}
    text.characters = String(penNode.content || '');

    // 폰트 크기
    if (penNode.fontSize && typeof penNode.fontSize === 'number') {
      try { text.fontSize = penNode.fontSize; } catch(e) {}
    }

    // 텍스트 색상 (fill 속성)
    var textColorStr = resolvePenColor(penNode.fill);
    if (textColorStr) {
      var textRgb = hexToFigmaRgb(textColorStr);
      if (textRgb) {
        var textFillEntry = { type: 'SOLID', color: { r: textRgb.r, g: textRgb.g, b: textRgb.b } };
        if (textRgb.a !== undefined && textRgb.a < 0.999) textFillEntry.opacity = textRgb.a;
        text.fills = [textFillEntry];
      }
    } else {
      text.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.06, b: 0.1 } }];
    }

    // 줄 높이
    if (penNode.lineHeight) {
      try {
        var lh = penNode.lineHeight;
        if (lh > 0 && lh < 5) {
          text.lineHeight = { value: lh * 100, unit: 'PERCENT' };
        } else {
          text.lineHeight = { value: lh, unit: 'PIXELS' };
        }
      } catch(e) {}
    }

    // 자간
    if (penNode.letterSpacing != null) {
      try { text.letterSpacing = { value: penNode.letterSpacing, unit: 'PIXELS' }; } catch(e) {}
    }

    // 텍스트 정렬
    if (penNode.textAlign) {
      try {
        var taMap = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' };
        text.textAlignHorizontal = taMap[penNode.textAlign] || 'LEFT';
      } catch(e) {}
    }

    // 텍스트 크기 조정
    try {
      if (penNode.width === 'fill_container') {
        text.textAutoResize = 'HEIGHT';
      } else if (typeof penNode.width === 'number' && penNode.width > 0) {
        if (typeof penNode.height === 'number' && penNode.height > 0) {
          text.resize(penNode.width, penNode.height);
        } else {
          text.textAutoResize = 'HEIGHT';
          text.resize(penNode.width, text.height || 20);
        }
      } else {
        text.textAutoResize = 'WIDTH_AND_HEIGHT';
      }
    } catch(e) {}

    if (penNode.opacity != null) { try { text.opacity = penNode.opacity; } catch(e) {} }
    return text;

  } else if (type === 'rectangle') {
    // ── rectangle ──
    var rect = figma.createRectangle();
    rect.name = penNode.name || 'Rectangle';
    var rectW = (typeof penNode.width === 'number' && penNode.width > 0) ? penNode.width : 100;
    var rectH = (typeof penNode.height === 'number' && penNode.height > 0) ? penNode.height : 100;
    rect.resize(rectW, rectH);

    applyPenFill(rect, penNode.fill);
    applyPenStroke(rect, penNode);

    if (penNode.cornerRadius != null) {
      try {
        if (Array.isArray(penNode.cornerRadius)) {
          rect.topLeftRadius     = penNode.cornerRadius[0] || 0;
          rect.topRightRadius    = penNode.cornerRadius[1] || 0;
          rect.bottomRightRadius = penNode.cornerRadius[2] || 0;
          rect.bottomLeftRadius  = penNode.cornerRadius[3] || 0;
        } else {
          rect.cornerRadius = penNode.cornerRadius;
        }
      } catch(e) {}
    }

    if (penNode.opacity != null) { try { rect.opacity = penNode.opacity; } catch(e) {} }
    return rect;

  } else if (type === 'ellipse') {
    // ── ellipse ──
    var ellipse = figma.createEllipse();
    ellipse.name = penNode.name || 'Ellipse';
    var elW = (typeof penNode.width === 'number' && penNode.width > 0) ? penNode.width : 20;
    var elH = (typeof penNode.height === 'number' && penNode.height > 0) ? penNode.height : 20;
    ellipse.resize(elW, elH);

    applyPenFill(ellipse, penNode.fill);
    applyPenStroke(ellipse, penNode);

    if (penNode.opacity != null) { try { ellipse.opacity = penNode.opacity; } catch(e) {} }
    return ellipse;

  } else if (type === 'image') {
    // ── image: placeholder 사각형 ──
    var imgRect = figma.createRectangle();
    imgRect.name = penNode.name || 'Image';
    var imgW = (typeof penNode.width === 'number' && penNode.width > 0) ? penNode.width : 100;
    var imgH = (typeof penNode.height === 'number' && penNode.height > 0) ? penNode.height : 100;
    imgRect.resize(imgW, imgH);
    imgRect.fills = [{ type: 'SOLID', color: { r: 0.78, g: 0.78, b: 0.82 } }];
    if (penNode.cornerRadius != null) {
      try { imgRect.cornerRadius = penNode.cornerRadius; } catch(e) {}
    }
    if (penNode.opacity != null) { try { imgRect.opacity = penNode.opacity; } catch(e) {} }
    return imgRect;
  }

  return null;
}

// .pen fill 값을 Figma fills 배열로 적용
function applyPenFill(node, fill) {
  if (!fill) {
    node.fills = [];
    return;
  }

  // 문자열 (hex 또는 $--variable 참조)
  if (typeof fill === 'string') {
    var resolvedColor = resolvePenColor(fill);
    if (resolvedColor) {
      var rgb = hexToFigmaRgb(resolvedColor);
      if (rgb) {
        // opacity < 1이면 opacity 포함, 아니면 생략(기본 1)
        var fillEntry = { type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b } };
        if (rgb.a !== undefined && rgb.a < 0.999) fillEntry.opacity = rgb.a;
        node.fills = [fillEntry];
      } else {
        node.fills = [];
      }
    } else {
      node.fills = [];
    }
    return;
  }

  // fill이 객체 { type: 'solid', color: '...' }
  if (fill && fill.type) {
    if (fill.type === 'solid' || fill.type === 'SOLID') {
      var c = resolvePenColor(fill.color || fill.value || '#ffffff');
      var cRgb = c ? hexToFigmaRgb(c) : null;
      if (cRgb) {
        var opVal = (fill.opacity != null) ? fill.opacity : cRgb.a;
        var fe = { type: 'SOLID', color: { r: cRgb.r, g: cRgb.g, b: cRgb.b } };
        if (opVal !== undefined && opVal < 0.999) fe.opacity = opVal;
        node.fills = [fe];
      } else {
        node.fills = [];
      }
    } else {
      node.fills = [];
    }
  } else {
    node.fills = [];
  }
}

// .pen stroke 적용 (stroke: { align, thickness, fill } 형식)
function applyPenStroke(node, penNode) {
  var stroke = penNode.stroke;
  if (!stroke && !penNode.strokeColor) return;

  var colorStr = null;
  var thickness = 1;

  if (stroke && typeof stroke === 'object') {
    // { align: 'inside', thickness: 1, fill: '#hex' 또는 '$--var' }
    colorStr = resolvePenColor(stroke.fill);
    thickness = stroke.thickness || 1;
  } else if (typeof stroke === 'string') {
    colorStr = resolvePenColor(stroke);
  } else if (penNode.strokeColor) {
    colorStr = resolvePenColor(penNode.strokeColor);
    thickness = penNode.strokeThickness || 1;
  }

  if (!colorStr) return;
  var rgb = hexToFigmaRgb(colorStr);
  if (!rgb) return;

  node.strokes = [{ type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b }, opacity: rgb.a }];
  node.strokeWeight = thickness;
  node.strokeAlign = 'INSIDE';
}

// Auto Layout 자식 sizing (부모 appendChild 후 호출)
function applyPenSizing(figmaNode, penNode) {
  var w = penNode.width;
  var h = penNode.height;

  try {
    if (w === 'fill_container') {
      figmaNode.layoutSizingHorizontal = 'FILL';
    } else if (w === 'hug_content' || w === null || w === undefined) {
      if (figmaNode.layoutMode && figmaNode.layoutMode !== 'NONE') {
        figmaNode.layoutSizingHorizontal = 'HUG';
      }
    } else if (typeof w === 'number' && w > 0) {
      figmaNode.layoutSizingHorizontal = 'FIXED';
    }
  } catch(e) {}

  try {
    if (h === 'fill_container') {
      figmaNode.layoutSizingVertical = 'FILL';
    } else if (h === 'hug_content' || h === null || h === undefined) {
      if (figmaNode.layoutMode && figmaNode.layoutMode !== 'NONE') {
        figmaNode.layoutSizingVertical = 'HUG';
      }
    } else if (typeof h === 'number' && h > 0) {
      figmaNode.layoutSizingVertical = 'FIXED';
    }
  } catch(e) {}
}

// Auto Layout 없는 부모 내 절대 배치 자식 처리
// fill_container → 부모 크기에 맞춤 (position 0,0)
function applyAbsoluteSizing(figmaNode, penNode, parentFrame) {
  try {
    var w = penNode.width;
    var h = penNode.height;
    var pw = parentFrame.width;
    var ph = parentFrame.height;
    var newW = figmaNode.width;
    var newH = figmaNode.height;
    var changed = false;

    if (w === 'fill_container' && pw > 0) { newW = pw; changed = true; }
    if (h === 'fill_container' && ph > 0) { newH = ph; changed = true; }

    if (changed) {
      figmaNode.resize(newW, newH);
      figmaNode.x = 0;
      figmaNode.y = 0;
    }
  } catch(e) {}
}

// Primary/Counter axis 정렬 매핑 (기존 코드 호환용)
function mapAlign(align) {
  var map = {
    start: 'MIN', center: 'CENTER', end: 'MAX',
    'space-between': 'SPACE_BETWEEN', baseline: 'BASELINE'
  };
  return map[align] || 'MIN';
}

// .pen 폰트 weight → Figma style 이름
function penFontWeightToStyle(weight) {
  if (!weight || weight === 'normal' || weight === 'NONE') return 'Regular';
  if (typeof weight === 'number') {
    if (weight <= 100) return 'Thin';
    if (weight <= 200) return 'ExtraLight';
    if (weight <= 300) return 'Light';
    if (weight <= 400) return 'Regular';
    if (weight <= 500) return 'Medium';
    if (weight <= 600) return 'SemiBold';
    if (weight <= 700) return 'Bold';
    if (weight <= 800) return 'ExtraBold';
    return 'Black';
  }
  // 문자열 ('700' 숫자 문자열 포함)
  var numW = parseInt(weight);
  if (!isNaN(numW)) return penFontWeightToStyle(numW);
  var map = {
    thin: 'Thin', extralight: 'ExtraLight', light: 'Light',
    regular: 'Regular', normal: 'Regular', medium: 'Medium',
    semibold: 'SemiBold', 'semi-bold': 'SemiBold', bold: 'Bold',
    extrabold: 'ExtraBold', 'extra-bold': 'ExtraBold', black: 'Black',
    heavy: 'Black'
  };
  return map[(weight + '').toLowerCase()] || 'Regular';
}

// ===== AI 디자인 명령 실행 =====

// HEX 색상 → Figma RGB 변환
function hexToRGB(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return {
    r: parseInt(h.slice(0,2), 16) / 255,
    g: parseInt(h.slice(2,4), 16) / 255,
    b: parseInt(h.slice(4,6), 16) / 255
  };
}

// 이름으로 현재 페이지에서 노드 찾기
function findNodeByName(name) {
  var page = figma.currentPage;
  function search(node) {
    if (node.name === name) return node;
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) {
        var found = search(node.children[i]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(page);
}

// 폰트 로드 헬퍼
async function loadAIFont(fontWeight) {
  var style = 'Regular';
  if (fontWeight === 'Bold' || fontWeight === 'bold') style = 'Bold';
  else if (fontWeight === 'Medium' || fontWeight === 'medium') style = 'Medium';
  else if (fontWeight === 'SemiBold') style = 'SemiBold';
  else if (fontWeight === 'Light' || fontWeight === 'light') style = 'Light';
  var fonts = [
    { family: 'Inter', style: style },
    { family: 'Roboto', style: style },
    { family: 'Inter', style: 'Regular' }
  ];
  for (var i = 0; i < fonts.length; i++) {
    try { await figma.loadFontAsync(fonts[i]); return fonts[i]; } catch(e) {}
  }
  return { family: 'Inter', style: 'Regular' };
}

// AI 명령 배열 실행
async function executeAICommands(commands) {
  if (!commands || !commands.length) {
    figma.ui.postMessage({ type: 'ai-generate-result', success: false, error: '명령이 없습니다' });
    return;
  }

  // 생성된 노드 참조 (name → node)
  var createdNodes = {};
  var allCreated = [];

  try {
    for (var i = 0; i < commands.length; i++) {
      var cmd = commands[i];

      // ─── createFrame ───
      if (cmd.action === 'createFrame') {
        var frame = figma.createFrame();
        frame.name = cmd.name || ('Frame ' + (i+1));
        frame.resize(
          typeof cmd.width === 'number' ? cmd.width : 375,
          typeof cmd.height === 'number' ? cmd.height : 812
        );
        frame.x = typeof cmd.x === 'number' ? cmd.x : 0;
        frame.y = typeof cmd.y === 'number' ? cmd.y : 0;

        // 배경색
        if (cmd.fill) {
          var rgb = hexToRGB(cmd.fill);
          frame.fills = [{ type: 'SOLID', color: rgb }];
        } else {
          frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        }

        // 둥근 모서리
        if (cmd.cornerRadius) frame.cornerRadius = cmd.cornerRadius;

        // Auto Layout
        var hasLayout = cmd.layout === 'horizontal' || cmd.layout === 'vertical' ||
                        cmd.gap != null || cmd.padding != null;
        if (hasLayout) {
          frame.layoutMode = cmd.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
          if (cmd.gap != null) frame.itemSpacing = cmd.gap;
          if (cmd.padding != null) {
            var p = cmd.padding;
            frame.paddingTop = p; frame.paddingBottom = p;
            frame.paddingLeft = p; frame.paddingRight = p;
          }
        }

        // 부모 설정
        if (cmd.parentName && createdNodes[cmd.parentName]) {
          createdNodes[cmd.parentName].appendChild(frame);
        } else if (cmd.parentId) {
          var parentNode = figma.getNodeById(cmd.parentId);
          if (parentNode && 'appendChild' in parentNode) parentNode.appendChild(frame);
          else figma.currentPage.appendChild(frame);
        } else {
          figma.currentPage.appendChild(frame);
        }

        createdNodes[frame.name] = frame;
        allCreated.push(frame);

      // ─── createText ───
      } else if (cmd.action === 'createText') {
        var fontDef = await loadAIFont(cmd.fontWeight);
        var text = figma.createText();
        text.name = cmd.name || ('Text ' + (i+1));
        await figma.loadFontAsync(fontDef);
        text.fontName = fontDef;
        text.characters = cmd.content || '';
        if (cmd.fontSize) text.fontSize = cmd.fontSize;
        if (cmd.color) {
          var rgb = hexToRGB(cmd.color);
          text.fills = [{ type: 'SOLID', color: rgb }];
        }
        if (cmd.width) {
          text.textAutoResize = 'HEIGHT';
          text.resize(cmd.width, text.height);
        }
        text.x = typeof cmd.x === 'number' ? cmd.x : 0;
        text.y = typeof cmd.y === 'number' ? cmd.y : 0;

        if (cmd.parentName && createdNodes[cmd.parentName]) {
          createdNodes[cmd.parentName].appendChild(text);
        } else if (cmd.parentId) {
          var parentNode = figma.getNodeById(cmd.parentId);
          if (parentNode && 'appendChild' in parentNode) parentNode.appendChild(text);
          else figma.currentPage.appendChild(text);
        } else {
          figma.currentPage.appendChild(text);
        }

        createdNodes[text.name] = text;
        allCreated.push(text);

      // ─── createRect ───
      } else if (cmd.action === 'createRect') {
        var rect = figma.createRectangle();
        rect.name = cmd.name || ('Rect ' + (i+1));
        rect.resize(
          typeof cmd.width === 'number' ? cmd.width : 100,
          typeof cmd.height === 'number' ? cmd.height : 100
        );
        rect.x = typeof cmd.x === 'number' ? cmd.x : 0;
        rect.y = typeof cmd.y === 'number' ? cmd.y : 0;
        if (cmd.fill) {
          var rgb = hexToRGB(cmd.fill);
          rect.fills = [{ type: 'SOLID', color: rgb }];
        }
        if (cmd.cornerRadius) rect.cornerRadius = cmd.cornerRadius;

        if (cmd.parentName && createdNodes[cmd.parentName]) {
          createdNodes[cmd.parentName].appendChild(rect);
        } else if (cmd.parentId) {
          var parentNode = figma.getNodeById(cmd.parentId);
          if (parentNode && 'appendChild' in parentNode) parentNode.appendChild(rect);
          else figma.currentPage.appendChild(rect);
        } else {
          figma.currentPage.appendChild(rect);
        }

        createdNodes[rect.name] = rect;
        allCreated.push(rect);

      // ─── createEllipse ───
      } else if (cmd.action === 'createEllipse') {
        var ellipse = figma.createEllipse();
        ellipse.name = cmd.name || ('Ellipse ' + (i+1));
        ellipse.resize(
          typeof cmd.width === 'number' ? cmd.width : 48,
          typeof cmd.height === 'number' ? cmd.height : 48
        );
        ellipse.x = typeof cmd.x === 'number' ? cmd.x : 0;
        ellipse.y = typeof cmd.y === 'number' ? cmd.y : 0;
        if (cmd.fill) {
          var rgb = hexToRGB(cmd.fill);
          ellipse.fills = [{ type: 'SOLID', color: rgb }];
        }

        if (cmd.parentName && createdNodes[cmd.parentName]) {
          createdNodes[cmd.parentName].appendChild(ellipse);
        } else if (cmd.parentId) {
          var parentNode = figma.getNodeById(cmd.parentId);
          if (parentNode && 'appendChild' in parentNode) parentNode.appendChild(ellipse);
          else figma.currentPage.appendChild(ellipse);
        } else {
          figma.currentPage.appendChild(ellipse);
        }

        createdNodes[ellipse.name] = ellipse;
        allCreated.push(ellipse);

      // ─── updateText ───
      } else if (cmd.action === 'updateText') {
        var target = findNodeByName(cmd.layerName);
        if (target && target.type === 'TEXT') {
          await figma.loadFontAsync(target.fontName);
          target.characters = cmd.content || target.characters;
        }

      // ─── updateFill ───
      } else if (cmd.action === 'updateFill') {
        var target = findNodeByName(cmd.layerName);
        if (target && 'fills' in target && cmd.fill) {
          var rgb = hexToRGB(cmd.fill);
          target.fills = [{ type: 'SOLID', color: rgb }];
        }

      // ─── alignSelection ───
      } else if (cmd.action === 'alignSelection') {
        var selection = figma.currentPage.selection;
        if (selection.length > 1) {
          var gap = typeof cmd.gap === 'number' ? cmd.gap : 16;
          var sorted = selection.slice().sort(function(a, b) {
            return cmd.direction === 'vertical' ? a.y - b.y : a.x - b.x;
          });
          var cursor = cmd.direction === 'vertical' ? sorted[0].y : sorted[0].x;
          for (var j = 0; j < sorted.length; j++) {
            if (cmd.direction === 'vertical') {
              sorted[j].y = cursor;
              cursor += sorted[j].height + gap;
            } else {
              sorted[j].x = cursor;
              cursor += sorted[j].width + gap;
            }
          }
        }
      }
    }

    // 생성된 노드들 선택
    if (allCreated.length > 0) {
      figma.currentPage.selection = allCreated;
      figma.viewport.scrollAndZoomIntoView(allCreated);
    }

    figma.ui.postMessage({
      type: 'ai-generate-result',
      success: true,
      count: allCreated.length
    });

  } catch(e) {
    figma.ui.postMessage({
      type: 'ai-generate-result',
      success: false,
      error: e.message
    });
  }
}

// ===== 테이블 토큰 → Light/Dark 모드 베리어블 생성/업데이트 =====
async function createTableVariables(collectionName, tokens) {
  try {
    figma.ui.postMessage({ type: 'table-variables-status', status: 'info', message: '베리어블 컬렉션 준비 중...' });

    // 컬렉션 찾기 또는 생성
    var collection = figma.variables.getLocalVariableCollections()
      .find(function(c) { return c.name === collectionName; });

    if (!collection) {
      collection = figma.variables.createVariableCollection(collectionName);
    }

    // Light 모드 확인/생성 (Figma modes 속성: { modeId, name })
    var lightMode = collection.modes.find(function(m) { return m.name === 'Light'; });
    if (!lightMode) {
      // 첫 번째 기본 모드를 Light로 이름 변경
      collection.renameMode(collection.modes[0].modeId, 'Light');
      lightMode = collection.modes[0];
    }
    var lightModeId = lightMode.modeId;

    // Dark 모드 확인/생성
    var darkModeId;
    var darkMode = collection.modes.find(function(m) { return m.name === 'Dark'; });
    if (darkMode) {
      darkModeId = darkMode.modeId;
    } else {
      try {
        darkModeId = collection.addMode('Dark');
      } catch(modeErr) {
        // 무료 플랜: 모드 추가 불가 → Light 모드 ID 재사용
        darkModeId = lightModeId;
        figma.ui.postMessage({ type: 'table-variables-status', status: 'info', message: '플랜 제한: Dark 모드 없이 Light 모드만 생성됩니다...' });
      }
    }

    var created = 0, updated = 0, errors = [];

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      try {
        var lightRgb = hexToFigmaRgb(token.light);
        var darkRgb = hexToFigmaRgb(token.dark);
        if (!lightRgb || !darkRgb) {
          errors.push(token.name + ': 색상 파싱 실패');
          continue;
        }

        // 기존 변수 찾기
        var existing = figma.variables.getLocalVariables('COLOR')
          .find(function(v) { return v.name === token.name && v.variableCollectionId === collection.id; });

        if (existing) {
          // 업데이트
          existing.setValueForMode(lightModeId, { r: lightRgb.r, g: lightRgb.g, b: lightRgb.b, a: 1 });
          existing.setValueForMode(darkModeId, { r: darkRgb.r, g: darkRgb.g, b: darkRgb.b, a: 1 });
          updated++;
        } else {
          // 새로 생성
          var variable = figma.variables.createVariable(token.name, collection, 'COLOR');
          variable.setValueForMode(lightModeId, { r: lightRgb.r, g: lightRgb.g, b: lightRgb.b, a: 1 });
          variable.setValueForMode(darkModeId, { r: darkRgb.r, g: darkRgb.g, b: darkRgb.b, a: 1 });
          created++;
        }
      } catch(e) {
        errors.push(token.name + ': ' + e.message);
      }
    }

    var msg = '';
    if (created > 0) msg += created + '개 생성 ';
    if (updated > 0) msg += updated + '개 업데이트 ';
    msg += '완료! (Light/Dark 모드)';
    if (errors.length > 0) msg += '\n⚠️ ' + errors.length + '개 실패';

    figma.ui.postMessage({
      type: 'table-variables-status',
      status: errors.length > 0 ? 'warning' : 'success',
      message: '✅ ' + msg
    });

  } catch(e) {
    figma.ui.postMessage({
      type: 'table-variables-status',
      status: 'error',
      message: '오류: ' + e.message
    });
  }
}

