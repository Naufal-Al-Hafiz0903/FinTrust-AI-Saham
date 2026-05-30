const TemplateUI = {
  sectorOption: (val, label, esc) => `<option value="${esc(val)}">${esc(label)}</option>`,
  quickButton: (t) => `<button onclick="qt('${t}')">${t}</button>`,
  errorNotice: () => `<section class="notice-card red"><h2>Input belum lengkap</h2><p>Kode saham dan nominal investasi sama-sama kosong. Isi salah satu agar sistem bisa bekerja dengan jelas.</p></section>`,
  peerError: (msg, esc) => `<div class="section-title">Perbandingan saham sejenis</div><section class="panel card"><p class="compare-note">Perbandingan belum tersedia: ${esc(msg)}.</p></section>`,
  ipoNotice: () => `<section class="notice-card"><h2>IPO / Watchlist</h2><p>Mode IPO / Watchlist belum memiliki harga pasar real dari Yahoo Finance. Sistem tidak merekomendasikan beli tanpa harga real.</p></section>`,

  renderPlan: function(plan, fmtMoney, fmtNum, esc) {
    if(!plan.ready) return `<div class="buy-status badge jual">Tidak Direkomendasikan Beli</div><p class="buy-note">${esc(plan.note)}</p>`;
    const qtyText = plan.isIdx ? `${plan.lots} lot (${plan.qty} saham)` : plan.qty > 0 ? `${plan.qty} saham utuh` : '0 saham utuh';
    const fracText = !plan.isIdx && plan.fractional > 0 ? ` Estimasi fractional: ${fmtNum(plan.fractional, 4)} saham jika broker mendukung.` : '';
    const status = plan.verdict === 'BELI' ? 'Direkomendasikan Beli' : 'Tidak Direkomendasikan Beli';
    const cls = plan.verdict === 'BELI' ? 'beli' : 'jual';
    const fxNote = plan.fxNote ? ` ${plan.fxNote}` : '';
    return `<div class="buy-status badge ${cls}">${status}</div><div class="buy-stat"><div><small>Alokasi disarankan</small><b>${Math.round(plan.alloc * 100)}%</b></div><div><small>Budget beli</small><b>${fmtMoney(plan.buyBudget, plan.stockCurrency)}</b></div><div><small>Jumlah beli</small><b>${qtyText}</b></div><div><small>Sisa dana</small><b>${fmtMoney(plan.left, plan.stockCurrency)}</b></div></div><p class="buy-note">${esc(plan.note)}${esc(fracText)}${esc(fxNote)}</p>`;
  },

  mainResult: function(ticker, ar, final, stock, market, planHtml, scoreColor, clsVerdict, esc, safeText, safeScore) {
    const v = clsVerdict(final.verdict), comp = Number(final.composite_score || 50), conf = safeScore(final.confidence, 50);
    const meta = { fundamental: 'Fundamental', technical: 'Technical', sentiment: 'Sentiment', risk: 'Risk' };
    const agentCards = Object.entries(meta).map(([k, l]) => {
      const r = ar[k] || {}, sc = safeScore(r.score, 50), sig = safeText(r.signal, 'NEUTRAL');
      return `<div class="panel card agent-result"><h4>${l} <span class="badge ${sig === 'HIGH' || sig === 'BEARISH' ? 'jual' : sig === 'MEDIUM' || sig === 'NEUTRAL' ? 'tunggu' : 'beli'}">${esc(sig)}</span></h4><div class="agent-bar"><i style="width:${sc}%;background:${scoreColor(sc)}"></i></div><p>${esc(safeText(r.summary, 'Analisis belum tersedia.'))}</p></div>`;
    }).join('');
    const why = (final.why_buy || []).slice(0, 4).map(x => `<li>${esc(safeText(x, 'Belum ada alasan beli kuat.'))}</li>`).join('');
    const whyn = (final.why_not || []).slice(0, 4).map(x => `<li>${esc(safeText(x, 'Risiko tetap perlu diperhatikan.'))}</li>`).join('');

    return `
      <section class="hero">
        <div class="panel hero-main">
          <div class="topline">
            <div class="company">
              <h2>${esc(final.company_name || ticker)}</h2>
              <p>${esc(ticker)} · ${esc(final.sector || stock?.exchange || 'Belum tersedia')} · ${market === 'global' ? 'Saham Luar Negeri' : market === 'idx' ? 'Saham Indonesia' : 'IPO / Watchlist'}</p>
            </div>
            <div class="badge ${v}">${esc(final.verdict || 'TUNGGU')}</div>
          </div>
          <div class="metrics">
            <div class="metric"><small>Harga saat ini</small><b>${esc(final.current_price || 'N/A')}</b></div>
            <div class="metric"><small>Target</small><b>${esc(final.target_price || 'N/A')}</b></div>
            <div class="metric"><small>Stop loss</small><b>${esc(final.stop_loss || 'N/A')}</b></div>
          </div>
          <div class="score-wrap">
            <div class="score" style="border-color:${scoreColor(comp)};color:${scoreColor(comp)}">${Math.round(comp)}</div>
            <div class="score-meta">
              <b>Composite Score · Confidence ${conf}%</b>
              <div class="bar"><i style="width:${conf}%;background:${scoreColor(comp)}"></i></div>
              <small>${esc(final.time_horizon || 'Short to medium term')}</small>
            </div>
          </div>
          <p class="summary">${esc(final.final_summary)}</p>
        </div>
        <div class="panel buy-card"><h3>Rekomendasi Pembelian</h3>${planHtml}</div>
      </section>
      <div class="section-title">Hasil per agent</div>
      <section class="agent-grid">${agentCards}</section>
      <div class="section-title">Reasoning</div>
      <section class="reason-grid">
        <div class="panel card"><b>Faktor dominan</b><p>${esc(final.reasoning?.dominant_factor)}</p></div>
        <div class="panel card"><b>Konsensus</b><p>${esc(final.reasoning?.signal_consensus)}</p></div>
        <div class="panel card"><b>Pertimbangan utama</b><p>${esc(final.reasoning?.key_consideration)}</p></div>
      </section>
      <div class="section-title">Alasan dan risiko</div>
      <section class="points">
        <div class="panel card"><b>Catatan positif</b><ul>${why}</ul></div>
        <div class="panel card"><b>Risiko / alasan tidak beli</b><ul>${whyn}</ul></div>
      </section>
      <div id="comparisonMount"></div>`;
  },

  comparison: function(title, subtitle, items, allocs, errors, fxText, clsVerdict, esc, fmtNum, fmtMoney, affordability) {
    const rows = items.map((it, i) => {
      const stock = it.stock, sd = it.scoreData, aff = it.aff || affordability(stock), al = allocs[i] || {};
      const can = aff.canBuy ? 'Mampu dibeli' : aff.note;
      return `<tr><td>${esc(it.ticker)}</td><td>${esc(stock.name || it.ticker)}</td><td>${esc(stock.formattedPrice || 'N/A')}</td><td>${Number.isFinite(Number(stock.changePercent)) ? fmtNum(stock.changePercent, 2) + '%' : 'N/A'}</td><td>${sd.score}</td><td><span class="badge ${clsVerdict(sd.verdict)}">${sd.verdict}</span></td><td>${esc(can)}</td><td>${esc(al.used > 0 ? al.text : 'Tidak Direkomendasikan Beli')}</td></tr>`;
    }).join('');
    const allocRows = items.map((it, i) => {
      const al = allocs[i] || {}, sd = it.scoreData;
      const detail = al.used > 0 ? `${fmtMoney(al.used, al.currency)} · ${al.text}` : (al.note || 'Tidak direkomendasikan beli saat ini.');
      return `<div class="alloc-item"><b>${esc(it.ticker)} · ${sd.verdict}</b><span>${esc(detail)}</span><span>${esc(sd.reason)}</span></div>`;
    }).join('');
    const errText = errors.length ? `<p class="compare-note">Beberapa ticker tidak berhasil diambil: ${esc(errors.map(e => e.ticker).join(', '))}. Data yang berhasil tetap ditampilkan.</p>` : '';

    return `<div class="section-title">Perbandingan saham sejenis</div>
    <section class="panel card">
      <div class="topline">
        <div class="company">
          <h2>${esc(title)}</h2><p>${esc(subtitle)}</p><p class="compare-note">${esc(fxText)}</p>
        </div>
      </div>
      <div class="compare-grid">
        <div>
          <div class="table-wrap">
            <table class="stock-table">
              <thead><tr><th>Kode</th><th>Nama</th><th>Harga</th><th>Change</th><th>Skor</th><th>Status</th><th>Kemampuan beli</th><th>Rekomendasi</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${errText}
          <p class="compare-note">Sistem hanya memberi alokasi jika nominal mampu membeli saham berdasarkan harga realtime. Status selain BELI selalu ditampilkan sebagai Tidak Direkomendasikan Beli.</p>
        </div>
        <div class="chart-card">
          <canvas id="scoreChart"></canvas><p>Grafik skor per saham.</p>
          <canvas id="pieChart" style="margin-top:14px"></canvas><p>Diagram alokasi pembelian. Jika tidak ada saham layak beli, dana tetap sebagai cash.</p>
        </div>
      </div>
      <div class="section-title">Rekomendasi pembelian</div>
      <div class="alloc-list">${allocRows}</div>
    </section>`;
  },

  noAffordable: function(title, subtitle, available, esc, fmtMoney) {
    const cheapest = available.length ? available.reduce((a, b) => (a.minCost || Infinity) <= (b.minCost || Infinity) ? a : b) : null;
    const minText = cheapest ? `Nominal minimal termurah dari data realtime saat ini adalah ${fmtMoney(cheapest.minCost, cheapest.currency)} untuk ${cheapest.ticker} (${cheapest.unit}).` : 'Tidak ada harga realtime yang berhasil diambil untuk cakupan ini.';
    return `<section class="notice-card"><h2>${esc(title)}</h2><p>${esc(subtitle)}</p><p>${esc(minText)}</p><p class="compare-note">Ubah nominal, pilih tipe saham yang sesuai, atau masukkan kode saham tertentu untuk analisis manual.</p></section>`;
  },

  predictionContainer: function(ticker) {
    return `
      <div class="section-title">Prediksi AI Multimodel</div>
      <div class="mode-row" style="margin-bottom: 15px;">
        <button id="btn-prophet" class="pill on" onclick="window.renderPredictionView('prophet', '${ticker}')">Prophet Model</button>
        <button id="btn-xgboost" class="pill" onclick="window.renderPredictionView('xgboost', '${ticker}')">XGBoost Model</button>
        <button id="btn-randomforest" class="pill" onclick="window.renderPredictionView('randomforest', '${ticker}')">Random Forest</button>
        <button id="btn-ensemble" class="pill" onclick="window.renderPredictionView('ensemble', '${ticker}')">Realtime Hybrid</button>
      </div>
      <section class="panel card" id="predictionCard">
        <p class="compare-note">Sedang menghitung perkiraan harga menggunakan AI Multimodel...</p>
      </section>
    `;
  },

  predictionLoading: (model) => `<p class="compare-note">Data prediksi ${model.toUpperCase()} sedang dimuat atau tidak tersedia.</p>`,
  predictionModelError: (model, error, esc) => `<p class="compare-note" style="color:var(--red);">Prediksi ${model.toUpperCase()} gagal: ${esc(error)}</p>`,
  predictionError: (msg, esc) => `<p class="compare-note" style="color:var(--red);">Gagal memuat modul prediksi: ${esc(msg)}</p>`,
  rawJsonView: (data) => `<pre style="background:var(--panel2); padding:12px; border-radius:8px; overflow-x:auto; font-size:12px; color:var(--text); margin-top: 10px;">${JSON.stringify(data, null, 2)}</pre>`,

  xgboostView: function(data, ticker, confPercent, trend, trendColor, trendIcon, signalNote, profitProjectionHtml, esc) {
    const fmt = (v, d = 2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: d }) : 'N/A';
    const metrics = data.metrics || {};
    const forecast = Array.isArray(data.forecast) ? data.forecast.slice(0, 5) : [];
    const metricColor = Number(metrics.sim_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)';
    const forecastRows = forecast.map(f => `<tr><td>${esc(f.date || 'N/A')}</td><td><b>${fmt(f.price)}</b></td><td>${fmt(f.expected_return_pct)}%</td><td style="color:var(--dim)">${fmt(f.lower)} - ${fmt(f.upper)}</td></tr>`).join('');
    const action = data.action || {};
    const priceText = data.current_price ? `${fmt(data.current_price)} ${esc(data.currency || '')}` : 'N/A';
    return `
      <p class="xgb-desc">Berikut adalah hasil analisis klasifikasi realtime dari model <b>XGBOOST</b> untuk saham <b>${esc(data.symbol || ticker)}</b>.</p>
      <div class="xgb-card">
        <p class="xgb-title">Sinyal Tren XGBoost ONNX + Data Realtime</p>
        <h2 class="xgb-trend" style="color:${trendColor};">${trendIcon} ${esc(trend)}</h2>
        <div class="xgb-box">
          <div class="xgb-flex"><span class="xgb-label">Harga terbaru Yahoo Finance</span><b class="xgb-val">${priceText}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Target 5 hari</span><b class="xgb-val">${fmt(data.target_5d)} ${esc(data.currency || '')}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Estimasi return 5 hari</span><b class="xgb-val">${fmt(data.expected_return_5d_pct)}%</b></div>
          <div class="xgb-flex"><span class="xgb-label">Keputusan model</span><b class="xgb-val">${esc(action.verdict || 'TUNGGU')}</b></div>
          <p class="compare-note">${esc(action.note || data.realtime_note || 'Data diperbarui saat request.')}</p>
        </div>
        <div class="xgb-box">
          <div class="xgb-flex"><span class="xgb-label">Tingkat Keyakinan (Confidence)</span><b class="xgb-val">${confPercent}%</b></div>
          <div class="xgb-bar-bg"><div class="xgb-bar-fill" style="width: ${confPercent}%; background: ${trendColor};"></div></div>
          ${signalNote}
          ${profitProjectionHtml}
          <div class="xgb-footer-note"><span style="color:var(--muted); font-size: 12px;">Rentang Waktu Prediksi:</span><b style="color:var(--text); font-size: 12px;">1 - 5 Hari Trading ke Depan</b></div>
        </div>
        <div class="xgb-box">
          <p class="xgb-title" style="margin-bottom: 12px;">📈 Proyeksi Harga Realtime</p>
          <div class="table-wrap"><table class="stock-table"><thead><tr><th>Tanggal</th><th>Target</th><th>Return</th><th>Rentang</th></tr></thead><tbody>${forecastRows || `<tr><td colspan="4">Forecast tidak tersedia</td></tr>`}</tbody></table></div>
        </div>
        <div class="xgb-box">
          <p class="xgb-title" style="margin-bottom: 12px;">📊 Backtest Model Bawaan</p>
          <div class="xgb-metrics-grid">
            <div class="xgb-metric"><small>Accuracy</small><br><b>${fmt(metrics.accuracy)}%</b></div>
            <div class="xgb-metric"><small>Precision (Keamanan)</small><br><b>${fmt(metrics.precision)}%</b></div>
            <div class="xgb-metric"><small>Sim. Profit</small><br><b style="color:${metricColor};">${Number(metrics.sim_profit || 0) >= 0 ? '+' : ''}${fmt(metrics.sim_profit)}%</b></div>
            <div class="xgb-metric"><small>F1 Score</small><br><b>${fmt(metrics.f1_score, 4)}</b></div>
          </div>
          <p style="color:var(--dim); font-size: 11px; margin-top: 12px; line-height: 1.4;">${esc(metrics.profile_note || 'Model membaca 12 fitur teknikal terbaru dan mengklasifikasikan arah harga.')}</p>
          <p style="color:var(--dim); font-size: 11px; margin-top: 8px;">Fetched: ${esc(data.fetched_at || 'N/A')}</p>
        </div>
      </div>
    `;
  },

  xgboostProfit: function(riskPercent) {
    return `
      <div class="xgb-proj profit">
          <b>✅ Proyeksi: Berpotensi Profit</b>
          <p>Sinyal naik cukup kuat untuk mengambil posisi. Namun, tetap ada <b>${riskPercent}% kemungkinan prediksi meleset (risiko gagal profit)</b>. Selalu gunakan batas Stop Loss.</p>
      </div>`;
  },

  xgboostWarn: function(riskPercent) {
    return `
      <div class="xgb-proj warn">
          <b>⚠️ Proyeksi: Rawan Gagal Profit</b>
          <p>Tren naik terdeteksi, tapi keyakinan model rendah. Terdapat <b>${riskPercent}% kemungkinan prediksi gagal</b>. Sangat disarankan untuk <i>wait and see</i>.</p>
      </div>`;
  },

  xgboostLoss: function(confPercent) {
    return `
      <div class="xgb-proj loss">
          <b>⛔ Proyeksi: Potensi Loss (Hindari Beli)</b>
          <p>Model memprediksi harga akan turun. Terdapat <b>${confPercent}% kemungkinan harga benar-benar anjlok</b>. Jangan membeli saat ini untuk menghindari kerugian.</p>
      </div>`;
  },

  prophetView: function(slicedForecast, ticker, esc, fmtNum, data = {}) {
    let tableRows = slicedForecast.map(f => {
      const price = f.price || f.prediction || f.close || f.yhat || 0;
      const lower = f.lower !== undefined ? f.lower : (f.yhat_lower || 0);
      const upper = f.upper !== undefined ? f.upper : (f.yhat_upper || 0);
      let rangeText = (lower && upper) ? `${fmtNum(lower)} - ${fmtNum(upper)}` : '-';
      return `<tr><td>${esc(f.date || f.ds || 'N/A')}</td><td style="color:var(--blue)"><b>${fmtNum(price)}</b></td><td>${fmtNum(f.expected_return_pct || 0)}%</td><td style="color:var(--dim)">${rangeText}</td></tr>`;
    }).join('');

    return `
      <p class="xgb-desc">Berikut adalah perkiraan pergerakan harga saham <b>${esc(data.symbol || ticker)}</b> menggunakan model <b>${esc(data.model || 'PROPHET')}</b>.</p>
      <div class="xgb-box">
        <div class="xgb-flex"><span class="xgb-label">Harga terbaru Yahoo Finance</span><b class="xgb-val">${fmtNum(data.current_price)} ${esc(data.currency || '')}</b></div>
        <div class="xgb-flex"><span class="xgb-label">Target 5 hari</span><b class="xgb-val">${fmtNum(data.target_5d)} ${esc(data.currency || '')}</b></div>
        <div class="xgb-flex"><span class="xgb-label">Estimasi return 5 hari</span><b class="xgb-val">${fmtNum(data.expected_return_5d_pct)}%</b></div>
        <p class="compare-note">${esc(data.realtime_note || 'Data diperbarui saat request.')}</p>
      </div>
      <div class="table-wrap">
        <table class="stock-table">
          <thead><tr><th>Tanggal</th><th>Perkiraan Harga Target</th><th>Return</th><th>Rentang Harga</th></tr></thead>
          <tbody>${tableRows || `<tr><td colspan="4" style="text-align:center;">Data tidak tersedia</td></tr>`}</tbody>
        </table>
      </div>
      <p class="compare-note" style="margin-top:10px;">*Catatan: Forecast di-anchor ke harga terbaru dari Yahoo Finance. Ini bukan jaminan harga masa depan dan bisa delay mengikuti aturan bursa.</p>
    `;
  },

  rfView: function(data, ticker, confPercent, trend, trendColor, arrowClass, signalNote, profitProjectionHtml, esc) {
    const fmt = (v, d = 2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: d }) : 'N/A';
    const metrics = data.metrics || {};
    const forecast = Array.isArray(data.forecast) ? data.forecast.slice(0, 5) : [];
    const metricColor = Number(metrics.sim_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)';
    const forecastRows = forecast.map(f => `<tr><td>${esc(f.date || 'N/A')}</td><td><b>${fmt(f.price)}</b></td><td>${fmt(f.expected_return_pct)}%</td><td style="color:var(--dim)">${fmt(f.lower)} - ${fmt(f.upper)}</td></tr>`).join('');
    const action = data.action || {};
    const priceText = data.current_price ? `${fmt(data.current_price)} ${esc(data.currency || '')}` : 'N/A';
    return `
      <p class="xgb-desc">Berikut adalah hasil analisis klasifikasi realtime dari model <b>RANDOM FOREST</b> untuk saham <b>${esc(data.symbol || ticker)}</b>.</p>
      <div class="xgb-card">
        <p class="xgb-title">Sinyal Tren Random Forest ONNX + Data Realtime</p>
        <div class="rf-trend-box" style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px; padding: 10px 0;">
          <div class="rf-arrow-graphic ${arrowClass}"></div>
          <div class="rf-info"><span class="rf-label">PROYEKSI TREN</span><h3 class="rf-trend-text" style="color: ${trendColor}; font-size: 26px; font-weight: 800; margin: 2px 0;">${esc(trend)}</h3></div>
        </div>
        <div class="xgb-box">
          <div class="xgb-flex"><span class="xgb-label">Harga terbaru Yahoo Finance</span><b class="xgb-val">${priceText}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Target 5 hari</span><b class="xgb-val">${fmt(data.target_5d)} ${esc(data.currency || '')}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Estimasi return 5 hari</span><b class="xgb-val">${fmt(data.expected_return_5d_pct)}%</b></div>
          <div class="xgb-flex"><span class="xgb-label">Keputusan model</span><b class="xgb-val">${esc(action.verdict || 'TUNGGU')}</b></div>
          <p class="compare-note">${esc(action.note || data.realtime_note || 'Data diperbarui saat request.')}</p>
        </div>
        <div class="xgb-box">
          <div class="xgb-flex"><span class="xgb-label">Tingkat Keyakinan (Confidence)</span><b class="xgb-val">${confPercent}%</b></div>
          <div class="xgb-bar-bg"><div class="xgb-bar-fill" style="width: ${confPercent}%; background: ${trendColor};"></div></div>
          ${signalNote}
          ${profitProjectionHtml}
          <div class="xgb-footer-note"><span style="color:var(--muted); font-size: 12px;">Rentang Waktu Prediksi:</span><b style="color:var(--text); font-size: 12px;">1 - 5 Hari Trading ke Depan</b></div>
        </div>
        <div class="xgb-box">
          <p class="xgb-title" style="margin-bottom: 12px;">📈 Proyeksi Harga Realtime</p>
          <div class="table-wrap"><table class="stock-table"><thead><tr><th>Tanggal</th><th>Target</th><th>Return</th><th>Rentang</th></tr></thead><tbody>${forecastRows || `<tr><td colspan="4">Forecast tidak tersedia</td></tr>`}</tbody></table></div>
        </div>
        <div class="xgb-box">
          <p class="xgb-title" style="margin-bottom: 12px;">🌳 Backtest Model Bawaan</p>
          <div class="xgb-metrics-grid">
            <div class="xgb-metric"><small>Accuracy</small><br><b>${fmt(metrics.accuracy)}%</b></div>
            <div class="xgb-metric" style="border-color: var(--green); background: rgba(98,196,130,0.05);"><small>Precision (Keamanan)</small><br><b style="color:var(--green);">${fmt(metrics.precision)}%</b></div>
            <div class="xgb-metric"><small>Sim. Profit</small><br><b style="color:${metricColor};">${Number(metrics.sim_profit || 0) >= 0 ? '+' : ''}${fmt(metrics.sim_profit)}%</b></div>
            <div class="xgb-metric"><small>F1 Score</small><br><b>${fmt(metrics.f1_score, 4)}</b></div>
          </div>
          <p style="color:var(--dim); font-size: 11.5px; margin-top: 14px; line-height: 1.5;">${esc(metrics.profile_note || 'Random Forest dipakai sebagai filter risiko berbasis fitur teknikal realtime.')}</p>
          <p style="color:var(--dim); font-size: 11px; margin-top: 8px;">Fetched: ${esc(data.fetched_at || 'N/A')}</p>
        </div>
      </div>
    `;
  },

  ensembleView: function(data, ticker, esc, fmtNum) {
    const forecast = Array.isArray(data.forecast) ? data.forecast.slice(0, 5) : [];
    const rows = forecast.map(f => `<tr><td>${esc(f.date || 'N/A')}</td><td><b>${fmtNum(f.price)}</b></td><td>${fmtNum(f.expected_return_pct)}%</td><td style="color:var(--dim)">${fmtNum(f.lower)} - ${fmtNum(f.upper)}</td></tr>`).join('');
    const action = data.action || {};
    const comps = data.components || {};
    const classifiers = Array.isArray(comps.classifiers) ? comps.classifiers : [];
    const compRows = classifiers.map(c => c.error ? `<li>${esc(c.key)} gagal: ${esc(c.error)}</li>` : `<li>${esc(c.key)}: ${esc(c.trend)} · confidence ${fmtNum(c.confidence_percent)}% · return 5 hari ${fmtNum(c.expected_return_5d_pct)}%</li>`).join('');
    const isGood = String(action.verdict || '').includes('BELI');
    const cls = isGood ? 'profit' : String(action.verdict || '').includes('HINDARI') ? 'loss' : 'warn';
    return `
      <p class="xgb-desc">Model <b>Realtime Hybrid</b> menggabungkan Prophet/fallback trend, XGBoost, Random Forest, dan harga terbaru Yahoo Finance untuk saham <b>${esc(data.symbol || ticker)}</b>.</p>
      <div class="xgb-card">
        <p class="xgb-title">Keputusan Gabungan Realtime</p>
        <h2 class="xgb-trend" style="color:${isGood ? 'var(--green)' : cls === 'loss' ? 'var(--red)' : 'var(--yellow)'};">${esc(action.verdict || 'TUNGGU')}</h2>
        <div class="xgb-proj ${cls}"><b>${esc(data.trend || 'NETRAL')} · Confidence ${fmtNum(data.confidence_percent)}%</b><p>${esc(action.note || data.realtime_note || 'Data diperbarui saat request.')}</p></div>
        <div class="xgb-box">
          <div class="xgb-flex"><span class="xgb-label">Harga terbaru</span><b class="xgb-val">${fmtNum(data.current_price)} ${esc(data.currency || '')}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Target 5 hari</span><b class="xgb-val">${fmtNum(data.target_5d)} ${esc(data.currency || '')}</b></div>
          <div class="xgb-flex"><span class="xgb-label">Estimasi return 5 hari</span><b class="xgb-val">${fmtNum(data.expected_return_5d_pct)}%</b></div>
          <div class="xgb-flex"><span class="xgb-label">Risk level</span><b class="xgb-val">${esc(action.risk_level || 'N/A')}</b></div>
        </div>
        <div class="xgb-box"><p class="xgb-title">📈 Proyeksi Harga 1-5 Hari</p><div class="table-wrap"><table class="stock-table"><thead><tr><th>Tanggal</th><th>Target</th><th>Return</th><th>Rentang</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Forecast tidak tersedia</td></tr>`}</tbody></table></div></div>
        <div class="xgb-box"><p class="xgb-title">Komponen Model</p><ul style="color:var(--muted); font-size:12px; padding-left:18px; text-align:left;"><li>Prophet/fallback: return 5 hari ${fmtNum(comps.prophet?.expected_return_5d_pct)}%</li>${compRows}</ul><p class="compare-note">Fetched: ${esc(data.fetched_at || 'N/A')}</p></div>
      </div>
    `;
  }

};