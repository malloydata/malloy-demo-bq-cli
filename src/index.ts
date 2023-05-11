/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */
/* eslint-disable no-console */
import * as malloy from "@malloydata/malloy";
import { promises as fs } from "fs";
import * as path from "path";
import { DuckDBConnection } from "@malloydata/db-duckdb";

export function pathToURL(filePath: string): URL {
  return new URL("file://" + path.resolve(filePath));
}

export function run(
  files: malloy.URLReader,
  args: string[]
): Promise<malloy.Result> {
  const connection = new DuckDBConnection("duckdb");
  const runtime = new malloy.Runtime(files, connection);

  const { query, model } = getOptions(args);

  // Current way to load a model and a query:
  const queryMaterializer = model
    ? runtime.loadModel(model).loadQuery(query)
    : runtime.loadQuery(query);

  return queryMaterializer.run();

  // Rename "runtime" to "malloy"?
  // Why do we need ModelMaterializer and QueryMaterializer? Can it just be Model and Query in the API?

  // Would want to do something like this:
  import { Malloy } from "@malloydata/malloy";
  const malloy = new Malloy(files, connection)
  const model = modelName ? malloy.loadModel(modelName) : undefined;
  const query = model ? model.loadNamedQuery(queryString) : malloy.loadQueryString(queryString);
  const result = query.run();

  // Other methods:

  // Run a query from a model:
  const query = model.loadQueryString(`
   flights -> {
     group_by: tail_num
     aggregate: flight_count is count()
   }`)
  const result = query.run()

  // Load a source from the model, run a named query on that source:
  const source = model.getSourceByName('sourceName')
  const namedQuery = source.loadNamedQuery('queryName')
  const result = namedQuery.run()

  // Add/updated/remove group_by, aggregate, filter, join to a Named Query:
  // A lot of the desired interface seems like it's defined in Composer:
  // https://github.com/malloydata/malloy-composer/blob/3945713c034ef5247eeeb804d5a36970fdccad00/src/app/hooks/use_query_builder.ts#L71
  const query = model.loadNamedQuery('queryName')
  query.addGroupBy('tail_num')
  query.addAggregate('flight_count', 'count()')
  query.addFilter('tail_num', '=', 'n12345')

  // Read properties of queries:
  const groupBys: string[] = query.getGroupBys()
  const aggregates: Aggregate[] = query.getAggregates()
  const filters: Filter[] = query.getFilters()
  const joins: Join[] = query.getJoins()
  const limit: number | undefined = query.getLimit()
  const orderBy: OrderBy[] = query.getOrderBy()

  // Load a source from the model. Maybe support some kind of QueryBuilder syntax directly on the source object?
  const source = model.getSourceByName('sourceName')

  // Add/update/remove measures, dimensions, filters, joins to a source.
  // Is this by reference or value? Do these updates also update the model, or do we need to save it back to the model?
  // Similar to the Query methods defined in Composer, we want that same interface on Sources.
  source.addMeasure('flight_count', 'count()')
  source.addDimension('tail_num_lower', 'lower(tail_num)')
  source.addFilter('tail_num_lower', '=', 'n12345')
  // possibly: model.saveSource('sourceName', source) ??

  // Read properties of the source:
  const dimensions: Dimension[] = source.getDimensions()
  const measures: Measure[] = source.getMeasures()
  const filters: Filter[] = source.getFilters()
  const joins: Join[] = source.getJoins()

  // Question: How do you create a Query from a Source object?
  // Maybe it's source.createQuery(), then you modify the query using the Query methods described above?
  const query = source.createQuery()
  query.addGroupBy('...')
}

function getOptions(args: string[]) {
  let query: malloy.QueryURL | malloy.QueryString | undefined;
  let model: malloy.ModelURL | malloy.ModelString | undefined;
  while (args.length >= 2) {
    const [option, value] = args;
    args = args.slice(2);
    if (option === "--query") {
      query = value;
    } else if (option === "--query-file") {
      query = new URL("file://" + path.resolve(value));
    } else if (option === "--model") {
      model = value;
    } else if (option === "--model-file") {
      model = new URL("file://" + path.resolve(value));
    }
  }
  if (query === undefined) {
    throw new Error("--query or --query-file is required");
  }
  return { query, model };
}

export async function main(): Promise<void> {
  const files = {
    readURL: async (url: URL) => {
      const filePath = url.toString().replace(/^file:\/\//, "");
      return fs.readFile(filePath, "utf8");
    },
  };
  console.log((await run(files, process.argv)).data.value);
}
