export const REPORT_SERVICE_PATH = "/xmlpserver/services/v2/ReportService";

export const DEFAULT_SOAP_TEMPLATE = `<!-- The template is now generated dynamically in soapService.ts based on SQL length -->
<!-- This is just for reference or manual overrides -->
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">
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
                  <!-- Parameters q1 through q9 are injected here dynamically -->
                  {{PARAMETERS}}
               </v2:listOfParamNameValues>
            </v2:parameterNameValues>
         </v2:reportRequest>
         <v2:userID>{{USERNAME}}</v2:userID>
         <v2:password>{{PASSWORD}}</v2:password>
      </v2:runReport>
   </soapenv:Body>
</soapenv:Envelope>`;

// The default URL is now just the base instance to simplify user input
export const DEFAULT_URL = "https://xxxx.fa.ocs.oraclecloud.com";

export const SAMPLE_SQL = `SELECT 
  PERSON_NUMBER,
  FIRST_NAME,
  LAST_NAME,
  EMAIL_ADDRESS
FROM PER_PERSON_NAMES_F
WHERE NAME_TYPE = 'GLOBAL'
  AND ROWNUM <= 50`;

// Sample dummy data for initial view if no API connection
export const DUMMY_DATA = {
  columns: ['PERSON_NUMBER', 'FIRST_NAME', 'LAST_NAME', 'EMAIL_ADDRESS'],
  rows: [
    { PERSON_NUMBER: '1001', FIRST_NAME: 'John', LAST_NAME: 'Doe', EMAIL_ADDRESS: 'john.doe@example.com' },
    { PERSON_NUMBER: '1002', FIRST_NAME: 'Jane', LAST_NAME: 'Smith', EMAIL_ADDRESS: 'jane.smith@example.com' },
  ]
};