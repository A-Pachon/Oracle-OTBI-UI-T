import { ConnectionConfig, QueryResult } from '../types';
import { REPORT_SERVICE_PATH } from '../constants';

const CHUNK_SIZE = 32767;

/**
 * Robust Base64 encoder that handles UTF-8 strings.
 */
const encodeBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte)
  ).join("");
  return btoa(binString);
};

/**
 * Decodes Base64 string back to UTF-8.
 */
const decodeBase64 = (str: string): string => {
  try {
    const binString = atob(str);
    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error("Failed to decode base64", e);
    return "";
  }
};

/**
 * Splits the SQL into Base64 chunks mapped to q1...q9.
 * Matches Python 'FusionSQLTool' logic.
 */
const prepareSqlParameters = (sql: string, rowLimit: number): string => {
  // 0. Sanitize SQL: Remove trailing semicolon which causes ORA-00907
  let cleanSql = sql.trim();
  if (cleanSql.endsWith(';')) {
    cleanSql = cleanSql.slice(0, -1);
  }

  // 1. Wrap SQL with dynamic row limit
  const wrappedSql = `SELECT * FROM (${cleanSql}) WHERE rownum <= ${rowLimit}`;
  
  // 2. Encode to Base64 (UTF-8 safe)
  const base64Sql = encodeBase64(wrappedSql);
  
  // 3. Split into chunks and generate XML items
  let paramXml = "";
  const totalLen = base64Sql.length;
  
  for (let i = 0; i < totalLen; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    
    // Safety check: The Data Model only supports q1 through q9
    if (chunkIndex >= 9) break;

    const chunk = base64Sql.substring(i, i + CHUNK_SIZE);
    const paramName = `q${chunkIndex + 1}`; // q1, q2, ...

    paramXml += `
        <v2:item>
            <v2:name>${paramName}</v2:name>
            <v2:values>
                <v2:item>${chunk}</v2:item>
            </v2:values>
        </v2:item>`;
  }

  return paramXml;
};

/**
 * Parses the Oracle BI Publisher XML output.
 */
const parseOracleXML = (xmlString: string): QueryResult => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Error parsing response XML from Oracle.");
  }

  const root = xmlDoc.documentElement;
  let rows: HTMLCollectionOf<Element> | NodeListOf<Element> = root.children;

  if (rows.length === 0) {
     return { columns: [], rows: [], rawXml: xmlString, executionTimeMs: 0 };
  }

  const resultRows: Record<string, string>[] = [];
  const columnsSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.nodeType !== 1) continue; 

    const rowData: Record<string, string> = {};
    
    for (let j = 0; j < row.children.length; j++) {
      const col = row.children[j];
      const colName = col.nodeName;
      const colValue = col.textContent || "";
      
      rowData[colName] = colValue;
      columnsSet.add(colName);
    }
    resultRows.push(rowData);
  }

  return {
    columns: Array.from(columnsSet),
    rows: resultRows,
    rawXml: xmlString,
    executionTimeMs: 0
  };
};

/**
 * Executes the SOAP request.
 */
export const executeSoapQuery = async (
  query: string,
  config: ConnectionConfig,
  rowLimit: number
): Promise<QueryResult> => {
  const startTime = performance.now();

  // 1. Generate Parameters (Chunking + Encoding)
  const parametersXml = prepareSqlParameters(query, rowLimit);

  // 2. Construct Payload
  let soapBody = "";
  
  if (config.soapTemplate && config.soapTemplate.includes('{{PARAMETERS}}')) {
      soapBody = config.soapTemplate
        .replace('{{USERNAME}}', config.username)
        .replace('{{PASSWORD}}', config.password)
        .replace('{{PARAMETERS}}', parametersXml);
  } else {
      soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">
        <soapenv:Header/>
        <soapenv:Body>
            <v2:runReport>
                <v2:reportRequest>
                    <v2:attributeFormat>xml</v2:attributeFormat>
                    <v2:byPassCache>True</v2:byPassCache>
                    <v2:flattenXML>True</v2:flattenXML>
                    <v2:reportAbsolutePath>/Custom/Human Capital Management/FusionSQLtoolTest1/FSTreport_2.xdo</v2:reportAbsolutePath>
                    <v2:parameterNameValues>
                       <v2:listOfParamNameValues>
                          ${parametersXml}
                       </v2:listOfParamNameValues>
                    </v2:parameterNameValues>
                </v2:reportRequest>
                <v2:userID>${config.username}</v2:userID>
                <v2:password>${config.password}</v2:password>
            </v2:runReport>
        </soapenv:Body>
      </soapenv:Envelope>`;
  }

  // 3. Construct Target URL (Auto-append service path if missing)
  let targetUrl = config.url.trim();
  // If the user only provided the base (e.g., https://host.com), append the report service path
  if (!targetUrl.includes("/xmlpserver")) {
      // Remove trailing slash if present
      if (targetUrl.endsWith('/')) {
        targetUrl = targetUrl.slice(0, -1);
      }
      targetUrl = `${targetUrl}${REPORT_SERVICE_PATH}`;
  }

  // 4. Handle Proxy URL construction
  let fetchUrl = targetUrl;
  
  if (config.corsProxy && config.corsProxy.trim().length > 0) {
      let proxy = config.corsProxy.trim();
      
      // Intelligent handling for corsproxy.io which requires '?' separator
      if (proxy === 'https://corsproxy.io') {
          proxy = 'https://corsproxy.io/?';
      }

      // Ensure proper separator for standard proxies if not using query param style
      // If it doesn't end with ? or /, add / (unless it's the specific corsproxy.io case handled above)
      if (!proxy.endsWith('?') && !proxy.endsWith('=') && !proxy.endsWith('/')) {
         proxy = `${proxy}/`;
      }
      
      fetchUrl = `${proxy}${targetUrl}`;
  }

  // 5. Send Request
  let response;
  try {
    response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""',
        },
        body: soapBody
    });
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error(
            `Network Error: Failed to fetch.\n\n` +
            `Cause: This is likely a Cross-Origin (CORS) restriction by the browser.\n` + 
            `Solution: Go to Settings and configure a CORS Proxy (e.g. https://corsproxy.io).`
        );
    }
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    // Try to extract faultstring if XML
    const faultMatch = text.match(/<faultstring>(.*?)<\/faultstring>/s);
    if (faultMatch && faultMatch[1]) {
        throw new Error(`Server returned ${response.status}: ${faultMatch[1]}`);
    }
    throw new Error(`Server returned ${response.status}: ${text}`);
  }

  const responseText = await response.text();

  // 6. Extract Base64 from SOAP Response
  const parser = new DOMParser();
  const doc = parser.parseFromString(responseText, "text/xml");
  
  // Check for Faults first
  const fault = doc.getElementsByTagName("faultstring")[0] || 
                doc.getElementsByTagName("soapenv:Fault")[0];
  if (fault) {
      throw new Error(`Oracle SOAP Fault: ${fault.textContent}`);
  }

  // Look for reportBytes
  const reportBytesNode = doc.getElementsByTagName("reportBytes")[0] || 
                          doc.getElementsByTagName("v2:reportBytes")[0] ||
                          doc.getElementsByTagName("ns2:reportBytes")[0];

  if (!reportBytesNode || !reportBytesNode.textContent) {
    throw new Error("No 'reportBytes' found in response. The report might have failed to generate output or the user permissions are insufficient.");
  }

  const base64Data = reportBytesNode.textContent;
  const decodedXml = decodeBase64(base64Data);

  // 7. Parse the inner XML Data
  const result = parseOracleXML(decodedXml);
  
  result.executionTimeMs = Math.round(performance.now() - startTime);
  return result;
};