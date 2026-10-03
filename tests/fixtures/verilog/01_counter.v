module counter #(parameter W=4)(input clk, input rst, output reg [W-1:0] q);
always @(posedge clk or posedge rst) if (rst) q <= 0; else q <= q + 1'b1;
endmodule
module tb; reg clk=0, rst=1; wire [3:0] q; counter #(.W(4)) dut(.clk(clk),.rst(rst),.q(q));
always #5 clk = ~clk;
initial $monitor("%t clk=%b rst=%b q=%d", $time, clk, rst, q);
initial begin #12 rst = 0; #100 $display("q=%d %h %b %0d", q, q, q, q); $finish; end endmodule
