<?php

namespace App\Services;

class XlsxWriter
{
    /**
     * @param array<int, array<int, string|int|float|null>> $rows
     */
    public function write(array $rows, string $sheetName = 'Sheet1'): string
    {
        $files = [
            '[Content_Types].xml' => $this->contentTypesXml(),
            '_rels/.rels' => $this->rootRelsXml(),
            'xl/workbook.xml' => $this->workbookXml($sheetName),
            'xl/_rels/workbook.xml.rels' => $this->workbookRelsXml(),
            'xl/styles.xml' => $this->stylesXml(),
            'xl/worksheets/sheet1.xml' => $this->worksheetXml($rows),
        ];

        return $this->zipStore($files);
    }

    private function worksheetXml(array $rows): string
    {
        $xmlRows = [];

        foreach ($rows as $rowIndex => $row) {
            $cells = [];
            $excelRow = $rowIndex + 1;

            foreach ($row as $columnIndex => $value) {
                $cellRef = $this->columnName($columnIndex + 1).$excelRow;
                $style = $rowIndex === 0 ? ' s="1"' : '';
                $text = $this->escape((string) ($value ?? ''));
                $cells[] = '<c r="'.$cellRef.'" t="inlineStr"'.$style.'><is><t>'.$text.'</t></is></c>';
            }

            $xmlRows[] = '<row r="'.$excelRow.'">'.implode('', $cells).'</row>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<cols>'
            .'<col min="1" max="1" width="14" customWidth="1"/>'
            .'<col min="2" max="2" width="28" customWidth="1"/>'
            .'<col min="3" max="3" width="22" customWidth="1"/>'
            .'<col min="4" max="7" width="16" customWidth="1"/>'
            .'</cols>'
            .'<sheetData>'.implode('', $xmlRows).'</sheetData>'
            .'</worksheet>';
    }

    private function columnName(int $column): string
    {
        $name = '';

        while ($column > 0) {
            $column--;
            $name = chr(65 + ($column % 26)).$name;
            $column = intdiv($column, 26);
        }

        return $name;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'</Types>';
    }

    private function rootRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
    }

    private function workbookXml(string $sheetName): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            .'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'.$this->escape($sheetName).'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>';
    }

    private function workbookRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>';
    }

    private function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            .'<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
            .'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>'
            .'</styleSheet>';
    }

    /**
     * @param array<string, string> $files
     */
    private function zipStore(array $files): string
    {
        $localParts = [];
        $centralParts = [];
        $offset = 0;
        [$dosTime, $dosDate] = $this->dosTimestamp();

        foreach ($files as $name => $contents) {
            $crc = crc32($contents);
            $size = strlen($contents);
            $nameLength = strlen($name);

            $localHeader = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                20,
                0,
                0,
                $dosTime,
                $dosDate,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
            ).$name;

            $centralParts[] = pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                0,
                0,
                $dosTime,
                $dosDate,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ).$name;

            $localParts[] = $localHeader.$contents;
            $offset += strlen($localHeader) + $size;
        }

        $centralDirectory = implode('', $centralParts);
        $centralOffset = $offset;
        $centralSize = strlen($centralDirectory);
        $fileCount = count($files);

        $end = pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $fileCount,
            $fileCount,
            $centralSize,
            $centralOffset,
            0,
        );

        return implode('', $localParts).$centralDirectory.$end;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function dosTimestamp(): array
    {
        $time = getdate();
        $dosTime = ($time['hours'] << 11) | ($time['minutes'] << 5) | intdiv($time['seconds'], 2);
        $dosDate = (($time['year'] - 1980) << 9) | ($time['mon'] << 5) | $time['mday'];

        return [$dosTime, $dosDate];
    }
}
