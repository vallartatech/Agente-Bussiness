import jsPDF from 'jspdf';

interface PDFReportData {
    id: number | string;
    folio?: string;
    fecha: string;
    sucursal: string;
    encargado: string;
    tecnico: string;
    tecnicoAvatar?: string | null;
    fechaInicio?: string | null;
    diagnostico: string;
    descripcion: string;
    materiales: string;
    observaciones: string;
    observacionesList?: { id: string; texto: string; imagenes: string[] }[];
    imagenes: {
        antes?: string | null;
        durante?: string | null;
        despues?: string | null;
        extra?: string | string[] | null;
    };
    firmaEmpresa?: string | null;
    equipo?: {
        tipo: string;
        marca: string;
        modelo: string;
        piezas?: string;
        garantia?: string;
    } | null;
    logoBase64?: string | null;
    refaccionesList?: { pieza: string; cantidad: number; costo_estimado: string }[];
    isVisita?: boolean;
}

// Función auxiliar para cargar imagen y retornar base64 (opcional, jsPDF puede manejar URLs si el server lo permite)
const getLogoBase64 = (): string => {
    // Por ahora usamos una ruta relativa o podemos inyectar un base64 si es necesario.
    // Usaremos la ruta que encontramos en el proyecto.
    return "/src/assets/imagenes/logo-agente-business.png";
};

const getCleanNotes = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    const cleanLines = lines.filter(line => !line.trim().startsWith('-'));
    return cleanLines.join('\n').trim();
};

/**
 * Compresses an image src (URL or base64) to a JPEG data URL at reduced scale/quality.
 * This dramatically reduces the size of images embedded in the PDF.
 */
const compressImageToJpeg = (src: string, maxWidth = 800, quality = 0.55): Promise<string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(src); // fallback: use original if compression fails
        img.src = src;
    });

export const generateMaintenanceReportPDF = async (data: PDFReportData, returnBlob = false) => {
    try {
        const doc = new jsPDF({ compress: true });
        const dynamicFolio = data.folio || `REP-${data.id.toString().padStart(5, '0')}`;
        const goldColor = [201, 155, 33]; // Dorado aproximado del logo
        const navyColor = [30, 41, 59]; // Navy slate

        const drawHeader = (titleText: string) => {
            doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.rect(0, 0, 210, 26, 'F');
            try {
                doc.addImage(data.logoBase64 || getLogoBase64(), 'PNG', 10, 3, 42, 20);
            } catch (e) {
                console.error("No se pudo cargar el logo en el PDF", e);
            }
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            const finalTitle = data.isVisita ? "COTIZACIÓN DE SERVICIO" : titleText;
            doc.text(finalTitle, 65, 12);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            const finalFolio = data.isVisita ? dynamicFolio.replace('REP-', 'COT-').replace('TRB-', 'COT-') : dynamicFolio;
            doc.text(`FOLIO: ${finalFolio}`, 65, 19);
            doc.text(`FECHA: ${data.fecha}`, 130, 19);
            doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
            doc.rect(0, 26, 210, 2, 'F');
        };

        // --- 1. CABECERA ---
        drawHeader("REPORTE DE SERVICIO");

        let nextY = 35;

        const drawSectionTitle = (title: string, y: number) => {
            doc.setFillColor(240, 240, 240);
            doc.rect(15, y, 180, 5, 'F');
            doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(title.toUpperCase(), 20, y + 4);
            return y + 7;
        };

        const drawSectionTitleHalf = (title: string, x: number, y: number, width: number) => {
            doc.setFillColor(240, 240, 240);
            doc.rect(x, y, width, 5, 'F');
            doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(title.toUpperCase(), x + 2, y + 4);
            return y + 7;
        };

        const leftX = 15;
        const rightX = 105;
        const colWidthHalf = 88;

        let leftY = 35;
        let rightY = 35;

        // --- 2. SECCIÓN: DATOS GENERALES ---
        leftY = drawSectionTitleHalf("Información General", leftX, leftY, colWidthHalf);
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        const drawFieldHalf = (label: string, value: string, x: number, y: number) => {
            doc.setFont("helvetica", "bold");
            doc.text(label, x + 2, y);
            doc.setFont("helvetica", "normal");
            doc.text(value || '---', x + 22, y);
        };

        drawFieldHalf("Sucursal:", data.sucursal, leftX, leftY);
        leftY += 5;
        drawFieldHalf("Encargado:", data.encargado, leftX, leftY);
        leftY += 5;
        drawFieldHalf("Técnico:", data.tecnico, leftX, leftY);
        leftY += 5;
        drawFieldHalf("Inició:", data.fechaInicio || data.fecha, leftX, leftY);
        leftY += 8;

        // Draw technician avatar if present (compressed)
        if (data.tecnicoAvatar) {
            try {
                const compressedAvatar = await compressImageToJpeg(data.tecnicoAvatar, 120, 0.6);
                doc.setDrawColor(220, 220, 220);
                doc.setFillColor(255, 255, 255);
                doc.rect(84, 42, 16, 16, 'FD');
                doc.addImage(compressedAvatar, 'JPEG', 84.5, 42.5, 15, 15);
            } catch (e) {
                console.error("Error drawing technician avatar in PDF:", e);
            }
        }

        // --- 3. DETALLES DEL SERVICIO (Right half top) ---
        rightY = drawSectionTitleHalf("Detalles del Servicio", rightX, rightY, 90);
        const drawTextAreaHalf = (label: string, text: string, x: number, y: number, width: number) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(label, x + 2, y);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(text || 'Sin información registrada.', width - 4);
            doc.text(lines, x + 2, y + 4);
            return y + (lines.length * 3.5) + 6;
        };

        rightY = drawTextAreaHalf(data.isVisita ? "Diagnóstico / Visita:" : "Diagnóstico / Reporte:", data.diagnostico, rightX, rightY, 90);

        nextY = Math.max(leftY, rightY) + 5;

        // --- 4. TRABAJO A REALIZAR / REALIZADO (Full width above materials) ---
        if (data.descripcion) {
            nextY = drawSectionTitle(data.isVisita ? "Trabajo a Realizar" : "Trabajo Realizado", nextY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);

            const descClean = data.descripcion.split('|||SERVICE_DATA|||')[0].trim();
            const numberedMatches = descClean.split(/(?=(?:^|\s+)\d+\.\s+)/g).map(s => s.trim()).filter(Boolean);
            
            if (numberedMatches.length > 1 || (numberedMatches.length === 1 && /^\d+\.\s+/.test(numberedMatches[0]))) {
                numberedMatches.forEach((itemStr, idx) => {
                    const cleanItem = itemStr.replace(/^\d+\.\s*/, '').trim();
                    const lineText = `${idx + 1}. ${cleanItem}`;
                    const splitLines = doc.splitTextToSize(lineText, 176);
                    doc.text(splitLines, 17, nextY + 1);
                    nextY += (splitLines.length * 4) + 1.5;
                });
                nextY += 3;
            } else {
                const descLines = doc.splitTextToSize(descClean || 'Sin descripción registrada.', 176);
                doc.text(descLines, 17, nextY + 1);
                nextY += (descLines.length * 4) + 4;
            }
        }

        // --- 5. MATERIALES Y REFACCIONES COTIZADOS (Full width or table) ---
        nextY = drawSectionTitle(data.isVisita ? "Materiales y Refacciones Cotizados" : "Refacciones y Materiales", nextY);
        doc.setFont("helvetica", "normal");
        
        let totalAmount = 0;
        if (data.isVisita && data.refaccionesList && data.refaccionesList.length > 0) {
            doc.setFontSize(8);
            data.refaccionesList.forEach((ref, idx) => {
                const qty = Number((ref as any).amount || ref.cantidad || 1);
                const unitPrice = parseFloat(ref.costo_estimado) || 0;
                const lineTotal = qty * unitPrice;
                totalAmount += lineTotal;
                
                const lineText = `${idx + 1}. ${ref.pieza.toUpperCase()}  |  Cant: ${qty}  |  Precio/U: $${unitPrice.toFixed(2)}  |  Total: $${lineTotal.toFixed(2)}`;
                const splitLine = doc.splitTextToSize(lineText, 176);
                doc.text(splitLine, 17, nextY + 1);
                nextY += (splitLine.length * 3.8) + 1;
            });
            
            if (totalAmount > 0) {
                const subtotal = totalAmount / 1.16;
                const iva = totalAmount - subtotal;
                
                nextY += 2;
                doc.setFont("helvetica", "bold");
                doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 140, nextY);
                nextY += 4;
                doc.text(`IVA (16%): $${iva.toFixed(2)}`, 140, nextY);
                nextY += 4;
                doc.text(`Total: $${totalAmount.toFixed(2)}`, 140, nextY);
                nextY += 6;
            }
        } else {
            if (!data.materiales) {
                doc.text("No se utilizaron refacciones.", 17, nextY + 1);
                nextY += 7;
            } else {
                const matLines = doc.splitTextToSize(data.materiales, 176);
                doc.text(matLines, 17, nextY + 1);
                nextY += (matLines.length * 3.8) + 4;
            }
        }

        // --- 4. EQUIPO ---
        if (data.equipo) {
            if (nextY > 190) { doc.addPage(); nextY = 20; }
            nextY = drawSectionTitle("Especificaciones del Equipo", nextY);

            doc.setDrawColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.rect(15, nextY, 180, 16);

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text("TIPO:", 20, nextY + 6);
            doc.text("MARCA:", 70, nextY + 6);
            doc.text("MODELO:", 130, nextY + 6);

            doc.setFont("helvetica", "normal");
            doc.text(data.equipo.tipo, 20, nextY + 11);
            doc.text(data.equipo.marca || 'N/A', 70, nextY + 11);
            doc.text(data.equipo.modelo || 'N/A', 130, nextY + 11);

            nextY += 24;
        }

        // --- 5. OBSERVACIONES FINALES (Ahora en la Hoja 1) ---
        if (nextY > 200) { doc.addPage(); nextY = 20; }
        nextY = drawSectionTitle(data.isVisita ? "Detalles o Notas Adicionales" : "Observaciones Finales", nextY);
        
        let obsText = "";
        if (data.isVisita) {
            obsText = getCleanNotes(data.materiales) || 'Sin detalles o notas adicionales.';
        } else {
            const hasObservations = (data.observacionesList && data.observacionesList.length > 0) || (data.observaciones && data.observaciones.trim().length > 0);
            obsText = hasObservations 
                ? 'Se anexan reportes fotográficos y observaciones en la hoja de Testigos Fotográficos.'
                : 'Sin observaciones adicionales.';
        }
            
        const obsLines = doc.splitTextToSize(obsText, 170);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(obsLines, 20, nextY + 3);
        nextY += (obsLines.length * 4) + 10;

        // --- SECCIÓN EVALUACIÓN (EXCLUSIVO TIENDA) ---
        if (!data.isVisita) {
            // Asegurarnos de que cabe en la primera hoja antes de la firma (si supera 165 se pasa a hoja 2)
            if (nextY > 165) { doc.addPage(); nextY = 20; }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.text("Nota: Para el caso de cambio de refacciones, es necesario agregar una memoria fotográfica donde se logre percibir el cambio.", 15, nextY);
            nextY += 6;

            nextY = drawSectionTitle("Exclusivo Tienda", nextY);

            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.text("CALIFICACIÓN AL TÉCNICO Y A SU TRABAJO EN ESCALA DEL 1 AL 10", 15, nextY + 2);

            doc.text("CALIFICACIÓN A LA EMPRESA", 115, nextY + 2);
            nextY += 6;

            doc.setFont("helvetica", "normal");

            // Left Column (Tecnico)
            const leftColX = 15;
            const lineStartX = 55;
            const lineEndX = 95;

            leftY = nextY;
            const drawRatingField = (label: string, y: number) => {
                doc.text(label, leftColX, y);
                doc.line(lineStartX, y, lineEndX, y);
                return y + 5;
            };

            leftY = drawRatingField("Presentacion", leftY);
            leftY = drawRatingField("Trato del tecnico", leftY);
            leftY = drawRatingField("Disponibilidad", leftY);
            leftY = drawRatingField("Trabajo Realizado", leftY);
            leftY = drawRatingField("Limpieza del trabajo", leftY);

            // Right Column (Empresa)
            const rightColX = 115;
            rightY = nextY;

            doc.text("Tiempo de respuesta", rightColX, rightY);
            doc.text("CALIFICACION", rightColX + 45, rightY);
            doc.line(rightColX + 68, rightY, rightColX + 75, rightY);
            rightY += 6;

            doc.text("Has visto mejoras con respecto al mantenimiento", rightColX, rightY);
            rightY += 5;
            doc.rect(rightColX + 5, rightY - 4, 8, 4);
            doc.text("SI", rightColX + 7, rightY - 0.5);
            doc.rect(rightColX + 25, rightY - 4, 8, 4);
            doc.text("NO", rightColX + 26, rightY - 0.5);
            doc.text("CALIFICACION", rightColX + 45, rightY);
            doc.line(rightColX + 68, rightY, rightColX + 75, rightY);
            rightY += 6;

            doc.text("Estas satisfecho con tu proveedor", rightColX, rightY);
            rightY += 5;
            doc.rect(rightColX + 5, rightY - 4, 8, 4);
            doc.text("SI", rightColX + 7, rightY - 0.5);
            doc.rect(rightColX + 25, rightY - 4, 8, 4);
            doc.text("NO", rightColX + 26, rightY - 0.5);
            doc.text("CALIFICACION", rightColX + 45, rightY);
            doc.line(rightColX + 68, rightY, rightColX + 75, rightY);

            nextY = Math.max(leftY, rightY) + 3;

            // Consejo
            doc.setFont("helvetica", "bold");
            doc.text("CONSEJO HACIA EL PROVEEDOR PARA SER MAS EFICIENTE:", 15, nextY);
            nextY += 5;
            doc.setDrawColor(0);

            // Dibujar exactamente 4 líneas para el consejo
            for (let i = 0; i < 4; i++) {
                doc.line(15, nextY, 195, nextY);
                nextY += 6;
            }
        }

        // --- 6. VALIDACIÓN Y CONFORMIDAD (Fija al fondo de la hoja) ---
        if (!data.isVisita) {
            let sigY = 240;
            if (nextY > 232) {
                doc.addPage();
                sigY = 240; // Asegurar que siempre esté en la misma posición en la nueva hoja
            }

            doc.setFillColor(240, 240, 240);
            doc.rect(15, sigY - 8, 180, 7, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
            doc.text("VALIDACIÓN Y CONFORMIDAD", 20, sigY - 3);

            doc.setDrawColor(180);
            doc.setTextColor(80, 80, 80);

            // Firma encargado
            doc.line(20, sigY + 22, 90, sigY + 22);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("NOMBRE Y FIRMA DEL ENCARGADO", 55, sigY + 28, { align: 'center' });

            // Sello sucursal
            doc.rect(115, sigY, 75, 30);
            doc.text("SELLO DE LA SUCURSAL", 152, sigY + 37, { align: 'center' });

            // Imagen de firma si existe
            if (data.firmaEmpresa && !data.firmaEmpresa.startsWith('data:application/pdf')) {
                try {
                    doc.addImage(data.firmaEmpresa, 'JPEG', 115, sigY, 75, 30);
                } catch (e) {
                    try { doc.addImage(data.firmaEmpresa, 'PNG', 115, sigY, 75, 30); } catch (e2) { }
                }
            }
        }

        // --- 7. PÁGINA 2: EVIDENCIA Y OBSERVACIONES ---
        // Build the lists of main images and observation images to determine if page 2 is needed
        const isVisitaMode = !!data.isVisita;
        const mainImages: { src: string; label: string }[] = [];
        if (!isVisitaMode) {
            if (data.imagenes?.antes) mainImages.push({ src: data.imagenes.antes, label: '1. ANTES (ESTADO INICIAL)' });
            if (data.imagenes?.durante) mainImages.push({ src: data.imagenes.durante, label: '2. DURANTE (PROCESO)' });
            if (data.imagenes?.despues) mainImages.push({ src: data.imagenes.despues, label: '3. DESPUÉS (FINALIZADO)' });
        }

        let obsListToRender = data.observacionesList;
        if (!obsListToRender || obsListToRender.length === 0) {
            const extraImgs: string[] = [];
            if (isVisitaMode) {
                if (data.imagenes?.antes) extraImgs.push(data.imagenes.antes);
                if (data.imagenes?.durante) extraImgs.push(data.imagenes.durante);
                if (data.imagenes?.despues) extraImgs.push(data.imagenes.despues);
            }
            if (data.imagenObservacion && !extraImgs.includes(data.imagenObservacion)) {
                extraImgs.push(data.imagenObservacion);
            }
            if (Array.isArray(data.imagenesObservacion)) {
                data.imagenesObservacion.forEach((img: string) => {
                    if (img && !extraImgs.includes(img)) extraImgs.push(img);
                });
            }
            const extraArray = Array.isArray(data.imagenes?.extra)
                ? data.imagenes.extra
                : (data.imagenes?.extra ? [data.imagenes.extra] : []);
            extraArray.forEach((img: string) => {
                if (img && !extraImgs.includes(img)) extraImgs.push(img);
            });

            if ((data.observaciones && data.observaciones.trim()) || extraImgs.length > 0) {
                obsListToRender = [{
                    id: 'fallback-obs',
                    texto: data.observaciones || (isVisitaMode ? (data.descripcion || 'Evidencias registradas durante la visita.') : ''),
                    imagenes: extraImgs.filter(Boolean) as string[]
                }];
            } else {
                obsListToRender = [];
            }
        }

        // Only add the photo page if there is actual content to show
        const hasObsImages = obsListToRender.some(o => o.imagenes && o.imagenes.length > 0);
        const hasPhotoPageContent = mainImages.length > 0 || hasObsImages || obsListToRender.some(o => o.texto && o.texto.trim());

        if (hasPhotoPageContent) {
            doc.addPage();
            drawHeader(data.isVisita ? "REGISTRO DE VISITA" : "TESTIGOS FOTOGRÁFICOS");
            nextY = 35;

            nextY = drawSectionTitle(data.isVisita ? "Registro Fotográfico de la Visita" : "Testigos Fotográficos", nextY);

            const imgSize = 55;
            const gap = 8;
            const startX = 15;
            let currentX = startX;
            let currentY = nextY;

            if (mainImages.length > 0) {
                for (const img of mainImages) {
                    if (img.src) {
                        try {
                            const compressed = await compressImageToJpeg(img.src, 600, 0.6);
                            doc.addImage(compressed, 'JPEG', currentX, currentY, imgSize, imgSize);
                        } catch (e) {
                            console.error("Error adding image to PDF:", e);
                        }
                        doc.setFontSize(9);
                        doc.setFont("helvetica", "bold");
                        doc.text(img.label, currentX + (imgSize / 2), currentY + imgSize + 5, { align: 'center' });
                    }
                    currentX += imgSize + gap;
                }
                currentY += imgSize + 15;
            }

            if (!data.isVisita && obsListToRender && obsListToRender.length > 0) {
                if (currentY > 240) {
                    doc.addPage();
                    drawHeader("TESTIGOS FOTOGRÁFICOS");
                    currentY = 35;
                }
                currentY = drawSectionTitle("Observaciones y Evidencias", currentY);

                for (const [idx, obs] of obsListToRender.entries()) {
                    if (currentY > 240) {
                        doc.addPage();
                        drawHeader("TESTIGOS FOTOGRÁFICOS");
                        currentY = 35;
                    }

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
                    doc.text(`Observación #${idx + 1}:`, 15, currentY);
                    currentY += 4;

                    const obsLines = doc.splitTextToSize(obs.texto || 'Sin observaciones registradas.', 180);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(80, 80, 80);
                    doc.text(obsLines, 15, currentY);
                    currentY += (obsLines.length * 4) + 4;

                    if (obs.imagenes && obs.imagenes.length > 0) {
                        const obsImgSize = 45;
                        const obsGap = 5;
                        let obsX = 15;

                        if (currentY + obsImgSize + 10 > 280) {
                            doc.addPage();
                            drawHeader("TESTIGOS FOTOGRÁFICOS");
                            currentY = 35;
                        }

                        for (const [imgIdx, img] of obs.imagenes.entries()) {
                            if (imgIdx > 0 && imgIdx % 4 === 0) {
                                obsX = 15;
                                currentY += obsImgSize + 5;
                                if (currentY + obsImgSize + 10 > 280) {
                                    doc.addPage();
                                    drawHeader("TESTIGOS FOTOGRÁFICOS");
                                    currentY = 35;
                                }
                            }
                            if (img) {
                                try {
                                    const compressed = await compressImageToJpeg(img, 500, 0.55);
                                    doc.addImage(compressed, 'JPEG', obsX, currentY, obsImgSize, obsImgSize);
                                } catch (e) {
                                    console.error("Error adding observation image:", e);
                                }
                            }
                            obsX += obsImgSize + obsGap;
                        }
                        currentY += obsImgSize + 10;
                    } else {
                        currentY += 4;
                    }
                }
            }
        }

        // Pie de página
        const pages = doc.internal.pages.length;
        for (let j = 1; j < pages; j++) {
            doc.setPage(j);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Mantenere - Reporte de Servicio Digital | Página ${j} de ${pages - 1}`, 105, 290, { align: 'center' });
        }

        if (returnBlob) {
            const blob = doc.output('blob');
            const finalFolio = data.isVisita ? dynamicFolio.replace('REP-', 'COT-').replace('TRB-', 'COT-') : dynamicFolio;
            return new File([blob], `${finalFolio}_Reporte.pdf`, { type: "application/pdf" });
        }
        doc.save(`${dynamicFolio}_Reporte.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw error;
    }
};


