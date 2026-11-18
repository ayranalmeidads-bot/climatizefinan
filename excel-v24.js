/* Climatize 2.4.1 — Exportação Excel real, sem dependências e sem upload de dados.
   Produz um pacote Open XML (.xlsx) não comprimido, válido para Excel/LibreOffice.
   Os valores dos lançamentos permanecem numéricos; datas são datas Excel e todos
   os textos inseridos pelo usuário são escritos como inlineStr, nunca fórmulas. */
(function () {
  'use strict';
  const enc = new TextEncoder();
  const E = value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const COL = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
  function crc32(data) {
    let crc = 0xffffffff;
    for (const b of data) { crc ^= b; for (let j=0;j<8;j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function writeU16(arr, pos, n) { arr[pos]=n&255; arr[pos+1]=(n>>>8)&255; }
  function writeU32(arr, pos, n) { writeU16(arr,pos,n&65535);writeU16(arr,pos+2,(n>>>16)&65535); }
  // ZIP sem compressão: evita CDNs e torna a exportação independente de bibliotecas externas.
  function zip(files) {
    const parts=[], centers=[];let offset=0;
    for (const [name,content] of Object.entries(files)) {
      const path=enc.encode(name), bytes=enc.encode(content), crc=crc32(bytes);
      if(bytes.length>0xffffffff) throw new Error('Planilha grande demais para exportação.');
      const local=new Uint8Array(30+path.length); writeU32(local,0,0x04034b50);writeU16(local,4,20);
      writeU16(local,6,0x0800);writeU16(local,8,0);writeU32(local,14,crc);
      writeU32(local,18,bytes.length);writeU32(local,22,bytes.length);writeU16(local,26,path.length);local.set(path,30);
      parts.push(local,bytes);
      const center=new Uint8Array(46+path.length);writeU32(center,0,0x02014b50);
      writeU16(center,4,20);writeU16(center,6,20);writeU16(center,8,0x0800);
      writeU32(center,16,crc);writeU32(center,20,bytes.length);writeU32(center,24,bytes.length);
      writeU16(center,28,path.length);writeU32(center,42,offset);center.set(path,46);
      centers.push(center);offset+=local.length+bytes.length;
    }
    const start=offset;for(const part of centers){parts.push(part);offset+=part.length;}
    const end=new Uint8Array(22);writeU32(end,0,0x06054b50);writeU16(end,8,centers.length);
    writeU16(end,10,centers.length);writeU32(end,12,offset-start);writeU32(end,16,start);parts.push(end);
    return new Blob(parts,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function stringCell(ref, value, style=0) {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${E(value)}</t></is></c>`;
  }
  function numberCell(ref,value,style=0) {
    const n=Number(value);return Number.isFinite(n)?`<c r="${ref}" s="${style}"><v>${n}</v></c>`:stringCell(ref,'',style);
  }
  function dateSerial(v) {
    const date=String(v||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    const [y,m,d]=date.split('-').map(Number);
    const ms=Date.UTC(y,m-1,d);
    const check=new Date(ms);
    if(check.getUTCFullYear()!==y||check.getUTCMonth()+1!==m||check.getUTCDate()!==d)return null;
    return Math.round((ms-Date.UTC(1899,11,30))/86400000);
  }
  function worksheet(rows,config={}) {
    const widths=config.widths||[17,20,25,45,20];
    const widthsXml=`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
    const lines=rows.map((row,i)=>`<row r="${i+1}">${row.join('')}</row>`).join('');
    const freeze=config.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const merges=config.merges?`<mergeCells count="${config.merges.length}">${config.merges.map(r=>`<mergeCell ref="${r}"/>`).join('')}</mergeCells>`:'';
    const autoFilter=config.autoFilter?`<autoFilter ref="${config.autoFilter}"/>`:'';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${widthsXml}<sheetData>${lines}</sheetData>${merges}${autoFilter}</worksheet>`;
  }
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF074F55"/><sz val="12"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF074F55"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF8F9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/><xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function criar({registros,filtros}) {
    const entries=registros||[];
    const entradas=entries.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+Number(t.valor||0),0);
    const saidas=entries.filter(t=>t.tipo==='saida').reduce((s,t)=>s+Number(t.valor||0),0);
    const resumo=[
      [stringCell('A1','CLIMATIZE — RELATÓRIO FINANCEIRO',4)],
      [stringCell('A2','Uso restrito · Dados exportados do aplicativo')],
      [stringCell('A3','Emissão'),stringCell('B3',new Date().toLocaleDateString('pt-BR'))],
      [stringCell('A4','Filtros'),stringCell('B4',filtros||'Todos os períodos')],
      [],
      [stringCell('A6','RESUMO FINANCEIRO',1)],
      [stringCell('A7','Total de entradas'),numberCell('B7',entradas,2)],
      [stringCell('A8','Total de saídas'),numberCell('B8',saidas,2)],
      [stringCell('A9','Saldo do período'),numberCell('B9',entradas-saidas,2)],
      [],
      [stringCell('A11','Lançamentos exportados'),numberCell('B11',entries.length)]
    ];
    const dados=[["Data","Tipo","Categoria","Descrição","Valor (R$)"].map((v,i)=>stringCell(COL(i)+'1',v,1))];
    entries.forEach((t,i)=>{
      const row=i+2, alt=i%2===1, style=alt?5:0;
      const serial=dateSerial(t.data);
      dados.push([
        serial===null?stringCell('A'+row,String(t.data||'').slice(0,10),style):numberCell('A'+row,serial,alt?7:3),
        stringCell('B'+row,t.tipo==='entrada'?'Entrada':t.tipo==='saida'?'Saída':t.tipo||'',style),
        stringCell('C'+row,t.categoria||'',style),
        stringCell('D'+row,t.descricao||'',style),
        numberCell('E'+row,t.valor,alt?6:2)
      ]);
    });
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/><sheet name="Lançamentos" sheetId="2" r:id="rId2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':styles,
      'xl/worksheets/sheet1.xml':worksheet(resumo,{widths:[27,50,19,20,20],merges:['A1:E1','A2:E2','B4:E4','A6:E6']}),
      'xl/worksheets/sheet2.xml':worksheet(dados,{widths:[16,15,28,65,20],freeze:true,autoFilter:'A1:E'+dados.length})
    };
    return zip(files);
  }
  function baixar(selecionado,nome) {
    if (!String(nome||'').toLowerCase().endsWith('.xlsx')) throw new Error('Informe um nome de arquivo Excel válido.');
    const blob=criar(selecionado),url=URL.createObjectURL(blob);
    try {
      const link=document.createElement('a');link.href=url;link.download=nome;document.body.appendChild(link);link.click();link.remove();
    } finally {setTimeout(()=>URL.revokeObjectURL(url),3000);}
    return blob;
  }
  window.ClimatizeXlsx=Object.freeze({criar,baixar});
})();
