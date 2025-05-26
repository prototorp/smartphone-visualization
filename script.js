// load data
d3.csv("cleaned_mobiles_data.csv").then(data => {
  data.forEach(d => {
    d.Launched_Year = +d["Launched Year"];
    const battery = +d["Battery Capacity"];
    d.Battery_Category = battery < 3000 ? "Low" : battery <= 5000 ? "Medium" : "High";
    const raw = d["Launched Price (USA)"] || "";
    const num = parseFloat(raw.replace(/[^\d]/g, ""));
    d.Avg_Price = isNaN(num) ? null : num;
    d.RAM = +((d["RAM"] || "").replace(/[^\d]/g, ""));
  });

  // populate filters
  const years = [...new Set(data.map(d => d.Launched_Year))].sort();
  const yearSelect = d3.select("#yearFilter");
  years.forEach(y => {
    yearSelect.append("option").attr("value", y).text(y);
  });

  d3.select("#yearFilter").on("change", update);
  d3.select("#batteryFilter").on("change", update);
  d3.select("#ramFilter").on("change", update);
  d3.select("#viewFilter").on("change", update);

  // update chart based on filters
  function update() {
    const selectedYear = +d3.select("#yearFilter").property("value");
    const selectedBattery = d3.select("#batteryFilter").property("value");
    const selectedRAM = +d3.select("#ramFilter").property("value");
    const view = d3.select("#viewFilter").property("value");

    const filtered = data.filter(d =>
      (isNaN(selectedYear) || d.Launched_Year === selectedYear) &&
      (selectedBattery === "All" || d.Battery_Category === selectedBattery) &&
      (isNaN(selectedRAM) || d.RAM === selectedRAM)
    );

    if (view === "line") {
      drawLineChart(data, selectedBattery, selectedRAM);
    } else {
      drawBarChart(filtered);
    }
  }

  // calculate chart dimensions to fit container
  function getChartDimensions(margin) {
    const container = d3.select("#priceChart").node().getBoundingClientRect();
    return {
      width: container.width - margin.left - margin.right,
      height: container.height - margin.top - margin.bottom
    };
  }
  // render bar chart
  function drawBarChart(dataset) {
    const svg = d3.select("#priceChart");
    svg.selectAll("*").remove();
    const margin = { top: 30, right: 120, bottom: 80, left: 60 };
    const { width, height } = getChartDimensions(margin);

    const avgByCompany = Array.from(
      d3.group(dataset, d => d["Company Name"]),
      ([company, models]) => ({
        company,
        avg_price: d3.mean(models, d => d.Avg_Price)
      })
    );

    const x = d3.scaleBand()
      .domain(avgByCompany.map(d => d.company))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(avgByCompany, d => d.avg_price)])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").call(d3.axisLeft(y));

    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end")
      .style("font-size", "12px");

    svg.append("text")
      .attr("x", margin.left + width / 2)
      .attr("y", height + margin.top + 60)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Company");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -margin.top - height / 2)
      .attr("y", 15)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Average Launch Price (USD)");

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute")
      .style("padding", "6px")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("display", "none");

    g.selectAll("rect")
      .data(avgByCompany)
      .enter()
      .append("rect")
      .attr("x", d => x(d.company))
      .attr("y", d => y(d.avg_price))
      .attr("height", d => height - y(d.avg_price))
      .attr("width", x.bandwidth())
      .attr("fill", "#69b3a2")
      .on("mouseover", function(event, d) {
        tooltip.style("display", "block")
          .html(`<strong>${d.company}</strong><br/>Avg. Price: $${Math.round(d.avg_price)}`);
      })
      .on("mousemove", event => {
        tooltip.style("top", (event.pageY - 40) + "px").style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", () => tooltip.style("display", "none"));
  }

  // render line chart
  function drawLineChart(data, batteryFilter, ramFilter) {
    const svg = d3.select("#priceChart");
    svg.selectAll("*").remove();
    const margin = { top: 30, right: 200, bottom: 150, left: 60 };
    const { width, height } = getChartDimensions(margin);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const filtered = data.filter(d =>
      (batteryFilter === "All" || d.Battery_Category === batteryFilter) &&
      (isNaN(ramFilter) || d.RAM === ramFilter)
    );

    const grouped = Array.from(
      d3.group(filtered, d => d["Company Name"]),
      ([company, values]) => ({
        company,
        values: Array.from(
          d3.group(values, d => d.Launched_Year),
          ([year, models]) => ({
            year: +year,
            avg_price: d3.mean(models, d => d.Avg_Price)
          })
        ).sort((a, b) => a.year - b.year)
      })
    );

    const allYears = [...new Set(filtered.map(d => d.Launched_Year))].sort();
    const x = d3.scalePoint().domain(allYears).range([0, width]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(grouped.flatMap(d => d.values.map(v => v.avg_price)))])
      .range([height, 0]);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(grouped.map(d => d.company));

    g.append("g").call(d3.axisLeft(y));
    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const usedLabelYs = [];

    grouped.forEach(group => {
      g.append("path")
        .datum(group.values)
        .attr("fill", "none")
        .attr("stroke", color(group.company))
        .attr("stroke-width", 2)
        .attr("d", d3.line()
          .x(d => x(d.year))
          .y(d => y(d.avg_price))
        );

      const last = group.values[group.values.length - 1];
      const lastX = x(last.year);
      let lastY = y(last.avg_price);
      const padding = 12;

      while (usedLabelYs.some(usedY => Math.abs(usedY - lastY) < padding)) {
        lastY += padding;
      }
      usedLabelYs.push(lastY);

      const labelOffsetX = 40;

      g.append("line")
        .attr("x1", lastX)
        .attr("y1", y(last.avg_price))
        .attr("x2", lastX + labelOffsetX - 5)
        .attr("y2", lastY)
        .attr("stroke", "#999")
        .attr("stroke-dasharray", "2,2");

      g.append("text")
        .attr("x", lastX + labelOffsetX)
        .attr("y", lastY)
        .text(group.company)
        .style("font-size", "10px")
        .style("fill", color(group.company))
        .style("alignment-baseline", "middle");
    });

    svg.append("text")
      .attr("x", margin.left + width / 2)
      .attr("y", height + margin.top + 40)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -margin.top - height / 2)
      .attr("y", 15)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Avg. Launch Price (USD)");
  }

  update();
});

